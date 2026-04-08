import type { DeclarationDefinitions } from '../../types/models'
import type { DefRegistry } from '../../types/registry'
import type { ModelContext } from '../../types/models'
import type { OperationDefinitionNode } from 'graphql'
import type { PluginConfig } from '../../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { TypeInfo } from 'graphql'

import { makeOperationModel } from '../model-builder'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

export type DocumentDeclaration = {
    location: string;
    declarations: DeclarationDefinitions;
}

type DocumentDeclarationCollector = {
    declarations: DeclarationDefinitions;
    addFragment(name: string): void;
    addOperation(node: OperationDefinitionNode): void;
}

const createDocumentDeclarationCollector = (
    defRegistry: DefRegistry,
    context: ModelContext
): DocumentDeclarationCollector => {
    const declarations: DeclarationDefinitions = {
        fragments: new Map(),
        operations: new Map(),
    }

    return {
        declarations,
        addFragment(name) {
            const fragmentFromRegistry = defRegistry.fragments.get(name)

            if (!declarations.fragments.has(name) && fragmentFromRegistry) {
                declarations.fragments.set(name, fragmentFromRegistry)
            }
        },
        addOperation(node) {
            if (!node.name?.value || declarations.operations.has(node.name.value)) return

            const operationModel = makeOperationModel(node, context)
            if (operationModel) {
                declarations.operations.set(node.name.value, operationModel)
            }
        },
    }
}

const createDocumentDeclarationVisitor = (collector: DocumentDeclarationCollector) => ({
    FragmentDefinition(node: { name: { value: string } }) {
        collector.addFragment(node.name.value)
    },
    OperationDefinition(node: OperationDefinitionNode) {
        collector.addOperation(node)
    },
})

const createDeclarationForDocument = (
    documentFile: Parameters<PluginFunction<PluginConfig>>[1][number],
    defRegistry: DefRegistry,
    context: ModelContext
): DocumentDeclaration | undefined => {
    if (!documentFile.document) return

    const collector = createDocumentDeclarationCollector(defRegistry, context)

    visit(
        documentFile.document,
        visitWithTypeInfo(
            new TypeInfo(context.schema),
            createDocumentDeclarationVisitor(collector)
        )
    )

    return {
        location: documentFile.location ?? '',
        declarations: collector.declarations,
    }
}

export const makeDocumentDeclarations = (
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    defRegistry: DefRegistry,
    context: ModelContext
): DocumentDeclaration[] => {
    return documents.flatMap(documentFile => {
        const declaration = createDeclarationForDocument(
            documentFile,
            defRegistry,
            context
        )

        return declaration ? [ declaration ] : []
    })
}
