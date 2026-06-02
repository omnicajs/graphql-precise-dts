import type { CustomScalarMappingRecord } from '../scalars/types'
import type { DocumentFile } from '../plugin-types'
import type { DocumentModelImportMap } from './document-model-imports'
import type { GenerationDirectivePolicies } from '../directives/types'
import type { OperationDefinitionNode } from 'graphql'
import type { RenderableDocumentModels } from './renderable/types'

import type {
    CollectedDocumentModels,
    FragmentModel,
    ModelContext,
} from '../models/types'

import { TypeInfo } from 'graphql'

import { collectDocumentModelImports } from './document-model-imports'
import { excludeImportedDuplicateOutputAliases } from './renderable/imported-aliases'
import { getOperationTypeName } from './naming'
import { makeOperationModel } from '../models/documents-builder'
import { makePlannedDocumentModels } from './planned'
import { prepareRenderableDocumentModels } from './renderable/prepare-models'
import { uncapitalize } from '../lib/strings'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

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
    addFragment(name: string): void;
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

const describeExportNameSource = (source: ExportNameSource): string => {
    switch (source.kind) {
        case EXPORT_NAME_SOURCE_KIND.IMPORT:
            return `imported type "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.FRAGMENT:
            return `fragment "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.VARIABLE_ALIAS:
            return `generated variable alias "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.OUTPUT_ALIAS:
            return `generated output alias "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.OPERATION_PAYLOAD:
            return `generated payload type "${source.name}"`
        case EXPORT_NAME_SOURCE_KIND.OPERATION_VARIABLES:
            return `generated variables type "${source.name}"`
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
        if (models.fragments.has(name) && !importMap.enums.has(name)) return
        assertUniqueExportName(usedTypeNames, { kind: EXPORT_NAME_SOURCE_KIND.IMPORT, name }, location)
    })

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

const createDocumentModelCollector = (
    fragments:  Map<string, FragmentModel>,
    context: ModelContext
): DocumentModelCollector => {
    const documentModels: CollectedDocumentModels = {
        fragments: new Map(),
        operations: new Map(),
    }

    return {
        models: documentModels,
        addFragment(name) {
            const fragmentFromRegistry = fragments.get(name)

            if (!documentModels.fragments.has(name) && fragmentFromRegistry) {
                documentModels.fragments.set(name, fragmentFromRegistry)
            }
        },
        addOperation(node) {
            if (!node.name?.value || documentModels.operations.has(node.name.value)) return

            const operationModel = makeOperationModel(node, context)
            if (operationModel) {
                documentModels.operations.set(node.name.value, operationModel)
            }
        },
    }
}

const createDocumentModelVisitor = (collector: DocumentModelCollector) => ({
    FragmentDefinition(node: { name: { value: string } }) {
        collector.addFragment(node.name.value)
    },
    OperationDefinition(node: OperationDefinitionNode) {
        collector.addOperation(node)
    },
})

const collectDocumentModelBundle = (
    documentFile: DocumentFile,
    fragments:  Map<string, FragmentModel>,
    context: ModelContext
): CollectedDocumentModelBundle | undefined => {
    if (!documentFile.document) return

    const collector = createDocumentModelCollector(fragments, context)

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
    const imports = collectDocumentModelImports(models, importMap)
    const importsNamesSet = new Set(imports.keys())
    const renderableModels = excludeImportedDuplicateOutputAliases(
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
    fragments:  Map<string, FragmentModel>,
    context: ModelContext,
    importMap: DocumentModelImportMap,
    customScalars: CustomScalarMappingRecord,
    directivePolicies: GenerationDirectivePolicies
): DocumentModelBundle[] => {
    return documents.flatMap(documentFile => {
        const documentModel = collectDocumentModelBundle(
            documentFile,
            fragments,
            context
        )

        return documentModel ? [ prepareDocumentModelBundle(documentModel, importMap, customScalars, directivePolicies) ] : []
    })
}
