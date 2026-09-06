import type {
    CompiledFragment,
    CompiledSelection,
} from '../model'
import type { FragmentIndex } from './fragments'

import { invalidDocument } from '../errors'
import { fragmentKey } from './fragments'
import { resolve } from './fragments'

type FragmentPathEntry = Pick<CompiledFragment, 'name' | 'sourcePath'>

export const validateCycles = (
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex,
    path: ReadonlyArray<FragmentPathEntry>
): void => {
    for (const selection of selections) {
        if (selection.kind === 'field' && selection.value.kind === 'composite') {
            validateCycles(selection.value.selections, fragments, path)
            continue
        }
        if (selection.kind === 'inline-fragment') {
            validateCycles(selection.selections, fragments, path)
            continue
        }
        if (selection.kind !== 'fragment-spread') continue

        const key = fragmentKey(selection.sourcePath, selection.name)
        const cycleStart = path.findIndex(
            entry => fragmentKey(entry.sourcePath, entry.name) === key
        )
        if (cycleStart >= 0) {
            const cycle = [ ...path.slice(cycleStart), selection ]
                .map(entry => `"${entry.name}"`)
                .join(' -> ')

            return invalidDocument(`Fragment cycle detected: ${cycle}`, selection.location)
        }

        const fragment = resolve(
            fragments,
            selection.sourcePath,
            selection.name,
            selection.location
        )
        validateCycles(fragment.selections, fragments, [ ...path, fragment ])
    }
}
