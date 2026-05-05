import type { CollectedDocumentModels } from '../models/types'
import type { CustomScalarMappings } from '../scalars/types'
import type { ConfigDirectivePolicies } from '../directives/types'
import type { DocumentFile } from '../plugin-types'
import type { DocumentModelImportMap } from './document-model-imports'
import type {
    FragmentModel,
    ModelContext,
} from '../models/types'
import type { OperationDefinitionNode } from 'graphql'
import type { RenderableDocumentModels } from './renderable-document-models'

import { TypeInfo } from 'graphql'

import { collectDocumentModelImports } from './document-model-imports'
import { makeOperationModel } from '../models/documents-builder'
import { makePlannedDocumentModels } from './planned-document-models'
import { prepareRenderableDocumentModels } from './renderable-document-models'
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
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): DocumentModelBundle => {
    const imports = collectDocumentModelImports(models, importMap)

    return {
        location,
        imports,
        models: prepareRenderableDocumentModels(
            makePlannedDocumentModels(models, [ ...imports.keys() ], customScalars, directivePolicies)
        ),
    }
}

export const makeDocumentModelBundles = (
    documents: DocumentFile[],
    fragments:  Map<string, FragmentModel>,
    context: ModelContext,
    importMap: DocumentModelImportMap,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
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
