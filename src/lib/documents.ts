import type {
    ASTNode,
    DocumentNode,
    FragmentDefinitionNode,
    FragmentSpreadNode,
    Source,
} from 'graphql'

import type { DocumentFile } from '../plugin-types'

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
