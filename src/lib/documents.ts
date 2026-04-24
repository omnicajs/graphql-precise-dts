import type { ASTNode } from 'graphql'
import type { DocumentFile } from '../config'
import type {
    DocumentNode,
    FragmentDefinitionNode,
    FragmentSpreadNode,
    Source,
} from 'graphql'

import { visit } from 'graphql'

import { Kind } from 'graphql'

const DEFAULT_GRAPHQL_SOURCE_NAME = 'GraphQL request'

export const findFragmentDefinitions = (
    documents: DocumentFile[]
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

export const makeDocumentLocationMap = (
    documents: DocumentFile[]
): WeakMap<Source, string> => {
    const documentLocations = new WeakMap<Source, string>()

    documents.forEach(({ document, location }) => {
        if (!document || !location) return

        const source = document.loc?.source ?? document.definitions[0]?.loc?.source
        if (source) documentLocations.set(source, location)
    })

    return documentLocations
}

export const formatNodeLocation = (
    node: ASTNode,
    documentLocations: WeakMap<Source, string>
): string | undefined => {
    const source = node.loc?.source
    if (!source) return

    const documentLocation = documentLocations.get(source)
        ?? (source.name !== DEFAULT_GRAPHQL_SOURCE_NAME ? source.name : undefined)

    if (!documentLocation) return

    return `${documentLocation}:${node.loc.startToken.line}:${node.loc.startToken.column}`
}

export const collectFragmentSpreads = (document: DocumentNode): FragmentSpreadNode[] => {
    const fragmentSpreads: FragmentSpreadNode[] = []

    visit(document, {
        FragmentSpread(node) {
            fragmentSpreads.push(node)
        },
    })

    return fragmentSpreads
}

export const emitMissingFragmentDefinitionWarnings = (
    documents: DocumentFile[],
    fragmentDefinitions: Map<string, FragmentDefinitionNode>
) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const missingFragmentSpreads = collectFragmentSpreads(documentFile.document)
            .filter(fragmentSpread => !fragmentDefinitions.has(fragmentSpread.name.value))

        if (!missingFragmentSpreads.length) return

        missingFragmentSpreads.forEach(fragmentSpread => {
            const documentLocation = formatNodeLocation(fragmentSpread, documentLocations)
                ?? documentFile.location
                ?? '<unknown document>'

            console.warn(
                `Fragment definition "${fragmentSpread.name.value}" referenced from "${documentLocation}" was not found among the documents configured for the plugin.`
            )
        })
    })
}
