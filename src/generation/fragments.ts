import type {
    ASTNode,
    FragmentDefinitionNode,
} from 'graphql'
import type {
    DocumentImport,
    ParsedDocumentSource,
} from './types'

import { CompilationError } from './errors'
import { Kind } from 'graphql'

export type IndexedFragment = {
    sourceId: string
    sourcePath: string
    definition: FragmentDefinitionNode
}

export type FragmentIndex = ReadonlyMap<string, ReadonlyArray<IndexedFragment>>

export const indexFragments = (
    sources: ReadonlyArray<ParsedDocumentSource>
): FragmentIndex => {
    const fragments = new Map<string, IndexedFragment[]>()

    for (const source of sources) {
        for (const definition of source.document.definitions) {
            if (definition.kind !== Kind.FRAGMENT_DEFINITION) continue

            const name = definition.name.value
            const indexed = fragments.get(name) ?? []

            indexed.push({
                sourceId: source.id,
                sourcePath: source.path,
                definition,
            })
            fragments.set(name, indexed)
        }
    }

    return fragments
}

export const resolveFragment = (
    fragments: FragmentIndex,
    name: string,
    sourcePath: string,
    imports: ReadonlyArray<DocumentImport>,
    node: ASTNode
): IndexedFragment => {
    const providers = fragments.get(name) ?? []
    const local = providers.find(provider => provider.sourcePath === sourcePath)
    if (local) return local

    const importedSourcePaths = new Set(imports.map(imported => imported.sourcePath))
    const imported = providers.filter(provider => importedSourcePaths.has(provider.sourcePath))
    if (imported.length === 1) return imported[0]!

    if (imported.length > 1) {
        throw new CompilationError(
            'ambiguous-fragment-provider',
            `Fragment "${name}" is defined by multiple imported documents: ${imported.map(
                provider => `"${provider.sourcePath}"`
            ).join(', ')}`,
            node
        )
    }

    if (imports.length) {
        throw new CompilationError(
            'missing-fragment-provider',
            `Fragment "${name}" was not found in the imported documents`,
            node
        )
    }

    if (providers.length) {
        throw new CompilationError(
            'missing-fragment-provider',
            `Fragment "${name}" is external; import its provider document explicitly`,
            node
        )
    }

    throw new CompilationError(
        'missing-fragment-provider',
        `Fragment "${name}" was not found among the documents selected by this target`,
        node
    )
}
