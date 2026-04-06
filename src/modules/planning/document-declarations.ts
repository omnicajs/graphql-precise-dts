import type {
    ConfigDirectivePolicies,
    ConfigScalar,
} from '../../config'
import type { DeclarationDefinitions } from '../../types/models'
import type { DefRegistry } from '../../types/registry'
import type {
    FragmentDefinitionNode,
    OperationDefinitionNode,
} from 'graphql'
import type { PluginConfig } from '../../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { TypeInfo } from 'graphql'

import { makeOperationModel } from '../model-builder'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

import { Kind } from 'graphql'

export type DocumentDeclaration = {
    location: string;
    declarations: DeclarationDefinitions;
}

type DocumentDeclarationCollector = {
    declarations: DeclarationDefinitions;
    addFragment(name: string): void;
    addOperation(node: OperationDefinitionNode): void;
}

type DocumentDeclarationCollectorOptions = {
    schema: Parameters<PluginFunction<PluginConfig>>[0];
    defRegistry: DefRegistry;
    fragmentCatalog: Map<string, FragmentDefinitionNode>;
    scalars: ConfigScalar;
    directivePolicies: ConfigDirectivePolicies;
}

const createDocumentDeclarationCollector = ({
    schema,
    defRegistry,
    fragmentCatalog,
    scalars,
    directivePolicies,
}: DocumentDeclarationCollectorOptions): DocumentDeclarationCollector => {
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

            const operationModel = makeOperationModel(
                node,
                schema,
                fragmentCatalog,
                scalars,
                directivePolicies
            )

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
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    documentFile: Parameters<PluginFunction<PluginConfig>>[1][number],
    collectorOptions: Omit<DocumentDeclarationCollectorOptions, 'schema'>
): DocumentDeclaration | undefined => {
    if (!documentFile.document) return

    const collector = createDocumentDeclarationCollector({
        schema,
        ...collectorOptions,
    })

    visit(
        documentFile.document,
        visitWithTypeInfo(
            new TypeInfo(schema),
            createDocumentDeclarationVisitor(collector)
        )
    )

    return {
        location: documentFile.location ?? '',
        declarations: collector.declarations,
    }
}

const createFragmentCatalog = (
    documents: Parameters<PluginFunction<PluginConfig>>[1]
): Map<string, FragmentDefinitionNode> => {
    const fragments = new Map<string, FragmentDefinitionNode>()

    documents.forEach(({ document }) =>
        document?.definitions.forEach(definition => {
            if (definition.kind === Kind.FRAGMENT_DEFINITION && !fragments.has(definition.name.value)) {
                fragments.set(definition.name.value, definition)
            }
        })
    )

    return fragments
}

export const makeDocumentDeclarations = (
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    defRegistry: DefRegistry,
    scalars: ConfigScalar = {},
    directivePolicies: ConfigDirectivePolicies = {}
): DocumentDeclaration[] => {
    const fragmentCatalog = createFragmentCatalog(documents)

    return documents.flatMap(documentFile => {
        const declaration = createDeclarationForDocument(
            schema,
            documentFile,
            {
                defRegistry,
                fragmentCatalog,
                scalars,
                directivePolicies,
            }
        )

        return declaration ? [ declaration ] : []
    })
}
