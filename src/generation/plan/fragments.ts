import type {
    CompiledDocument,
    CompiledFragment,
} from '../model'
import type { SourceLocation } from '../types'

import { CompilationError } from '../errors'

export type FragmentIndex = ReadonlyMap<string, CompiledFragment>

export const fragmentKey = (sourcePath: string, name: string): string => `${sourcePath}\0${name}`

export const createIndex = (
    documents: ReadonlyArray<CompiledDocument>
): FragmentIndex => new Map(documents.flatMap(document => document.definitions.flatMap(
    definition => definition.kind === 'fragment'
        ? [[ fragmentKey(definition.sourcePath, definition.name), definition ]]
        : []
)))

export const resolve = (
    fragments: FragmentIndex,
    sourcePath: string,
    name: string,
    location: SourceLocation
): CompiledFragment => {
    const fragment = fragments.get(fragmentKey(sourcePath, name))
    if (!fragment) {
        throw new CompilationError(
            'unavailable-fragment-provider',
            `Fragment "${name}" provider "${sourcePath}" is unavailable after compilation`,
            location
        )
    }

    return fragment
}
