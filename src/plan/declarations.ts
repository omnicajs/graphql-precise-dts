import type {
    DocumentModels,
    FragmentModel,
} from '../models/types'
import type { ModelContext } from '../models/types'
import type { OperationDefinitionNode } from 'graphql'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { TypeInfo } from 'graphql'

import { makeOperationModel } from '../models/documents-builder'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

export type DocumentModelBundle = {
    location: string;
    models: DocumentModels;
}

type DocumentModelCollector = {
    models: DocumentModels;
    addFragment(name: string): void;
    addOperation(node: OperationDefinitionNode): void;
}

const createDocumentModelCollector = (
    fragments:  Map<string, FragmentModel>,
    context: ModelContext
): DocumentModelCollector => {
    const documentModels: DocumentModels = {
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

const createDocumentModelBundle = (
    documentFile: Parameters<PluginFunction<PluginConfig>>[1][number],
    fragments:  Map<string, FragmentModel>,
    context: ModelContext
): DocumentModelBundle | undefined => {
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

export const makeDocumentModelBundles = (
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    fragments:  Map<string, FragmentModel>,
    context: ModelContext
): DocumentModelBundle[] => {
    return documents.flatMap(documentFile => {
        const documentModel = createDocumentModelBundle(
            documentFile,
            fragments,
            context
        )

        return documentModel ? [ documentModel ] : []
    })
}
