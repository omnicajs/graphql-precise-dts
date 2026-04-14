import type { DocumentNode } from 'graphql'
import type { FragmentDefinitionNode } from 'graphql'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { visit } from 'graphql'

import { Kind } from 'graphql'

export const findFragmentDefinitions = (
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

export const collectFragmentSpreadNames = (document: DocumentNode): string[] => {
    const fragmentSpreadNames = new Set<string>()

    visit(document, {
        FragmentSpread(node) {
            fragmentSpreadNames.add(node.name.value)
        },
    })

    return [ ...fragmentSpreadNames ]
}

export const emitMissingFragmentDefinitionWarnings = (
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    fragmentDefinitions: Map<string, FragmentDefinitionNode>
) => {
    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const missingFragmentNames = collectFragmentSpreadNames(documentFile.document)
            .filter(fragmentName => !fragmentDefinitions.has(fragmentName))

        if (!missingFragmentNames.length) return

        missingFragmentNames.forEach(fragmentName => {
            const documentLocation = documentFile.location ?? '<unknown document>'

            console.warn(
                `Fragment definition "${fragmentName}" referenced from "${documentLocation}" was not found among the documents configured for the plugin.`
            )
        })
    })
}
