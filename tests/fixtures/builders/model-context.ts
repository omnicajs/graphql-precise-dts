import type { ConfigDirectivePolicies, ConfigScalars } from '../../../src/config'
import type { FragmentDefinitionNode } from 'graphql'
import type { ModelContext } from '../../../src/models/types'
import type { PluginConfig } from '../../../src/config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { Kind } from 'graphql'

type TestDocumentFile = Parameters<PluginFunction<PluginConfig>>[1][number]

type MakeTestModelContextArgs = {
    schema: Parameters<PluginFunction<PluginConfig>>[0];
    documents?: TestDocumentFile[];
    customScalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

const collectFragmentDefinitions = (
    documents: TestDocumentFile[] = []
): Map<string, FragmentDefinitionNode> => {
    const fragmentDefinitions = new Map<string, FragmentDefinitionNode>()

    documents.forEach(({ document }) => {
        document?.definitions.forEach(definition => {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                fragmentDefinitions.set(definition.name.value, definition)
            }
        })
    })

    return fragmentDefinitions
}

export const makeTestModelContext = ({
    schema,
    documents = [],
    customScalars = {},
    directivePolicies = {},
}: MakeTestModelContextArgs): ModelContext => ({
    schema,
    fragmentDefinitions: collectFragmentDefinitions(documents),
    customScalars,
    directivePolicies,
})
