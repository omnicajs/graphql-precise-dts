import type { CollectedDocumentModels } from '../models/types'
import type { CustomScalarMappingRecord } from '../scalars/types'
import type { DocumentFile } from '../plugin-types'
import type { DocumentModelImportMap } from './document-model-imports'
import type { FragmentDefinitionNode } from 'graphql'
import type { GenerationDirectivePolicies } from '../directives/types'
import type { ModelContext } from '../models/types'
import type { NamingConvention } from '../naming'
import type { OperationDefinitionNode } from 'graphql'
import type { RenderableDocumentModels } from './renderable/types'

import { TypeInfo } from 'graphql'

import { collectDocumentModelImports } from './document-model-imports'
import { createNamingConvention } from '../naming'
import { deduplicateImportedOutputAliases } from './renderable/deduplicate-imported-output-aliases'
import { findDocumentFragmentDefinitions } from '../lib/documents'
import {
    makeFragmentModel,
    makeOperationModel,
} from '../models/documents-builder'
import { makePlannedDocumentModels } from './planned'
import { prepareRenderableDocumentModels } from './renderable/prepare-models'
import { validateDocumentBundleExportNames } from '../diagnostics/declaration-errors'
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

const EXACT_TYPE_NAME = 'Exact'

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
            if (!node.name?.value) return
            if (documentModels.operations.has(node.name.value)) return

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
    naming: NamingConvention,
    directivePolicies: GenerationDirectivePolicies
): DocumentModelBundle => {
    const imports = collectDocumentModelImports(models, importMap, location)
    const renderImportName = (name: string): string => {
        if (importMap.enums.has(name)) return naming.typeName(name)
        /* v8 ignore next -- @preserve collectDocumentModelImports only returns enum and fragment imports. */
        if (!importMap.fragments.has(name)) return name

        return naming.fragmentName(name)
    }
    const renderImports = new Map(
        [ ...imports.entries() ].map(([ name, moduleSpecifier ]) => [
            renderImportName(name),
            moduleSpecifier,
        ])
    )
    const importedFragmentNames = new Set(
        [ ...imports.keys() ].filter(name => importMap.fragments.has(name))
    )
    const importsNamesSet = new Set(renderImports.keys())
    if ([ ...models.operations.values() ].some(({ variables }) => variables.length > 0)) {
        importsNamesSet.add(EXACT_TYPE_NAME)
    }

    const renderableModels = deduplicateImportedOutputAliases(
        prepareRenderableDocumentModels(
            makePlannedDocumentModels(models, [ ...importsNamesSet ], customScalars, naming, directivePolicies)
        ),
        importedFragmentNames
    )

    validateDocumentBundleExportNames(location, renderImports, renderableModels, naming)

    return {
        location,
        imports: renderImports,
        models: renderableModels,
    }
}

export const makeDocumentModelBundles = (
    documents: DocumentFile[],
    context: ModelContext,
    importMap: DocumentModelImportMap,
    customScalars: CustomScalarMappingRecord,
    naming: NamingConvention = createNamingConvention(),
    directivePolicies: GenerationDirectivePolicies = {}
): DocumentModelBundle[] => {
    return documents.flatMap(documentFile => {
        const documentModel = collectDocumentModelBundle(
            documentFile,
            context,
            importMap
        )

        return documentModel
            ? [ prepareDocumentModelBundle(documentModel, importMap, customScalars, naming, directivePolicies) ]
            : []
    })
}
