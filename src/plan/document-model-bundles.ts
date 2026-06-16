import type { CollectedDocumentModels } from '../models/types'
import type { CustomScalarMappingRecord } from '../scalars/types'
import type { DocumentFile } from '../plugin-types'
import type { DocumentModelImportMap } from './document-model-imports'
import type { FragmentDefinitionNode } from 'graphql'
import type { GenerationDirectivePolicies } from '../directives/types'
import type { ModelContext } from '../models/types'
import type { OperationDefinitionNode } from 'graphql'
import type { RenderableDocumentModels } from './renderable/types'

import { TypeInfo } from 'graphql'

import { collectDocumentModelImports } from './document-model-imports'
import { deduplicateImportedOutputAliases } from './renderable/deduplicate-imported-output-aliases'
import { findDocumentFragmentDefinitions } from '../lib/documents'
import { getOperationTypeName } from './naming'
import {
    makeFragmentModel,
    makeOperationModel,
} from '../models/documents-builder'
import { makePlannedDocumentModels } from './planned'
import { prepareRenderableDocumentModels } from './renderable/prepare-models'
import { uncapitalize } from '../lib/strings'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

const normalizeDocumentLocation = (location: string): string => location.split('\\').join('/')

type CollectedDocumentModelBundle = {
    location: string;
    models: CollectedDocumentModels;
}

export type DocumentModelBundle = {
    location: string;
    imports: Map<string, string>;
    models: RenderableDocumentModels;
}

type DocumentModelCollector = {
    models: CollectedDocumentModels;
    addFragment(node: FragmentDefinitionNode): void;
    addOperation(node: OperationDefinitionNode): void;
}

const EXPORT_NAME_SOURCE_KIND = {
    IMPORT: 'import',
    FRAGMENT: 'fragment',
    VARIABLE_ALIAS: 'variableAlias',
    OUTPUT_ALIAS: 'outputAlias',
    OPERATION_PAYLOAD: 'operationPayload',
    OPERATION_VARIABLES: 'operationVariables',
    OPERATION_VALUE: 'operationValue',
} as const

type ExportNameSource = {
    kind: typeof EXPORT_NAME_SOURCE_KIND[keyof typeof EXPORT_NAME_SOURCE_KIND];
    name: string;
}

const EXACT_TYPE_NAME = 'Exact'

const describeExportNameSource = (source: ExportNameSource): string => {
    switch (source.kind) {
        case EXPORT_NAME_SOURCE_KIND.IMPORT:
            return `imported type "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.FRAGMENT:
            return `fragment "${source.name}"`
        /* v8 ignore next -- @preserve variable alias collisions are prevented by NameAllocator */
        case EXPORT_NAME_SOURCE_KIND.VARIABLE_ALIAS:
            return `generated variable alias "${source.name}"`
        /* v8 ignore next -- @preserve output alias collisions are prevented by NameAllocator */
        case EXPORT_NAME_SOURCE_KIND.OUTPUT_ALIAS:
            return `generated output alias "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.OPERATION_PAYLOAD:
            return `generated payload type "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.OPERATION_VARIABLES:
            return `generated variables type "${source.name}"`
        /* v8 ignore next -- @preserve operation value collisions are preceded by operation type-name collisions */
        case EXPORT_NAME_SOURCE_KIND.OPERATION_VALUE:
            return `generated document export "${source.name}"`
    }
}

const assertUniqueExportName = (
    usedNames: Map<string, ExportNameSource>,
    source: ExportNameSource,
    location: string
) => {
    const existingSource = usedNames.get(source.name)
    if (existingSource) {
        throw new Error(
            `Name collision detected in generated declaration exports for "${location}": `
            + `"${source.name}" is used both by ${describeExportNameSource(existingSource)} `
            + `and by ${describeExportNameSource(source)}.`
        )
    }

    usedNames.set(source.name, source)
}

const validateDocumentBundleExportNames = (
    location: string,
    importMap: DocumentModelImportMap,
    imports: Map<string, string>,
    models: RenderableDocumentModels
) => {
    const usedTypeNames = new Map<string, ExportNameSource>()
    const usedValueNames = new Map<string, ExportNameSource>()

    imports.forEach((_, name) => {
        /* v8 ignore next -- @preserve collectDocumentModelImports skips local fragment spreads; this is defensive for externally supplied import maps. */
        if (models.fragments.has(name) && !importMap.enums.has(name)) return
        assertUniqueExportName(usedTypeNames, { kind: EXPORT_NAME_SOURCE_KIND.IMPORT, name }, location)
    })

    if ([ ...models.operations.values() ].some(({ variables }) => variables.length > 0)) {
        assertUniqueExportName(usedTypeNames, { kind: EXPORT_NAME_SOURCE_KIND.IMPORT, name: EXACT_TYPE_NAME }, location)
    }

    models.variableAliases.forEach(({ aliasName }) => {
        assertUniqueExportName(usedTypeNames, { kind: EXPORT_NAME_SOURCE_KIND.VARIABLE_ALIAS, name: aliasName }, location)
    })

    models.outputAliases.forEach(({ aliasName }) => {
        assertUniqueExportName(usedTypeNames, { kind: EXPORT_NAME_SOURCE_KIND.OUTPUT_ALIAS, name: aliasName }, location)
    })

    models.fragments.forEach((_, name) => {
        assertUniqueExportName(usedTypeNames, { kind: EXPORT_NAME_SOURCE_KIND.FRAGMENT, name }, location)
    })

    models.operations.forEach((operation, key) => {
        const operationTypeName = getOperationTypeName(key, operation.operationType)

        assertUniqueExportName(
            usedTypeNames,
            { kind: EXPORT_NAME_SOURCE_KIND.OPERATION_VARIABLES, name: `${operationTypeName}Variables` },
            location
        )
        assertUniqueExportName(
            usedTypeNames,
            { kind: EXPORT_NAME_SOURCE_KIND.OPERATION_PAYLOAD, name: `${operationTypeName}Payload` },
            location
        )
        assertUniqueExportName(
            usedValueNames,
            { kind: EXPORT_NAME_SOURCE_KIND.OPERATION_VALUE, name: uncapitalize(operationTypeName) },
            location
        )
    })
}

const createDocumentModelCollector = (context: ModelContext): DocumentModelCollector => {
    const documentModels: CollectedDocumentModels = {
        fragments: new Map(),
        operations: new Map(),
    }

    return {
        models: documentModels,
        addFragment(node) {
            if (!documentModels.fragments.has(node.name.value)) {
                documentModels.fragments.set(node.name.value, makeFragmentModel(node, context))
            }
        },
        addOperation(node) {
            if (!node.name?.value || documentModels.operations.has(node.name.value)) return

            const operationModel = makeOperationModel(node, context)
            /* v8 ignore next -- @preserve Valid operations produce models when the schema defines the corresponding operation root type. */
            if (operationModel) {
                documentModels.operations.set(node.name.value, operationModel)
            }
        },
    }
}

const createDocumentModelVisitor = (collector: DocumentModelCollector) => ({
    FragmentDefinition(node: FragmentDefinitionNode) {
        collector.addFragment(node)
    },
    OperationDefinition(node: OperationDefinitionNode) {
        collector.addOperation(node)
    },
})

const addFragmentDefinition = (
    fragmentDefinitions: Map<string, FragmentDefinitionNode>,
    source: { definition?: FragmentDefinitionNode }
) => {
    const definition = source.definition
    /* v8 ignore next -- @preserve Import maps produced by makeDocumentModelImportMap attach fragment definitions before bundle merging. */
    if (definition && !fragmentDefinitions.has(definition.name.value)) {
        fragmentDefinitions.set(definition.name.value, definition)
    }
}

const findDocumentModelFragmentDefinitions = (
    documentFile: DocumentFile,
    context: ModelContext,
    importMap: DocumentModelImportMap
): Map<string, FragmentDefinitionNode> => {
    const location = documentFile.location ? normalizeDocumentLocation(documentFile.location) : ''
    const documentImports = importMap.documentImports.get(location)
    if (!documentImports?.size) {
        return findDocumentFragmentDefinitions(documentFile.document, context.fragmentDefinitions)
    }

    const fragmentDefinitions = findDocumentFragmentDefinitions(documentFile.document)

    importMap.fragments.forEach(sources => {
        sources
            .filter(source => source.location && documentImports.has(source.location))
            .forEach(source => addFragmentDefinition(fragmentDefinitions, source))
    })

    return fragmentDefinitions
}

const collectDocumentModelBundle = (
    documentFile: DocumentFile,
    context: ModelContext,
    importMap: DocumentModelImportMap
): CollectedDocumentModelBundle | undefined => {
    if (!documentFile.document) return

    const collector = createDocumentModelCollector({
        ...context,
        fragmentDefinitions: findDocumentModelFragmentDefinitions(documentFile, context, importMap),
    })

    visit(
        documentFile.document,
        visitWithTypeInfo(
            new TypeInfo(context.schema),
            createDocumentModelVisitor(collector)
        )
    )

    return {
        location: documentFile.location ?? '',
        models: collector.models,
    }
}

const prepareDocumentModelBundle = (
    { location, models }: CollectedDocumentModelBundle,
    importMap: DocumentModelImportMap,
    customScalars: CustomScalarMappingRecord,
    directivePolicies: GenerationDirectivePolicies
): DocumentModelBundle => {
    const imports = collectDocumentModelImports(models, importMap, location)
    const importsNamesSet = new Set(imports.keys())
    if ([ ...models.operations.values() ].some(({ variables }) => variables.length > 0)) {
        importsNamesSet.add(EXACT_TYPE_NAME)
    }

    const renderableModels = deduplicateImportedOutputAliases(
        prepareRenderableDocumentModels(
            makePlannedDocumentModels(models, [ ...importsNamesSet ], customScalars, directivePolicies)
        ),
        importsNamesSet
    )

    validateDocumentBundleExportNames(location, importMap, imports, renderableModels)

    return {
        location,
        imports,
        models: renderableModels,
    }
}

export const makeDocumentModelBundles = (
    documents: DocumentFile[],
    context: ModelContext,
    importMap: DocumentModelImportMap,
    customScalars: CustomScalarMappingRecord,
    directivePolicies: GenerationDirectivePolicies
): DocumentModelBundle[] => {
    return documents.flatMap(documentFile => {
        const documentModel = collectDocumentModelBundle(
            documentFile,
            context,
            importMap
        )

        return documentModel ? [ prepareDocumentModelBundle(documentModel, importMap, customScalars, directivePolicies) ] : []
    })
}
