import type {
    CompiledField,
    CompiledSelection,
    CompiledTypename,
} from '../model'
import type { FragmentIndex } from './fragments'
import type { TypeId } from '@/schema/types'

import { resolve } from './fragments'

export type EffectiveSelection = CompiledField | CompiledTypename

export const collectEffectiveSelections = (
    selections: ReadonlyArray<CompiledSelection>,
    type: TypeId,
    fragments: FragmentIndex
): ReadonlyArray<EffectiveSelection> => selections.flatMap(selection => {
    if (!selection.included) return []

    if (selection.kind === 'inline-fragment') {
        return selection.possibleTypes.includes(type)
            ? collectEffectiveSelections(
                selection.selections,
                type,
                fragments
            )
            : []
    }
    if (selection.kind === 'fragment-spread') {
        if (!selection.possibleTypes.includes(type)) return []

        const fragment = resolve(
            fragments,
            selection.sourcePath,
            selection.name,
            selection.location
        )

        return collectEffectiveSelections(
            fragment.selections,
            type,
            fragments
        )
    }

    return [ selection ]
})

export const hasTypeSpecificSelections = (
    types: ReadonlyArray<TypeId>,
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): boolean => selections.some(selection => {
    if (!selection.included) return false
    if (selection.kind === 'inline-fragment') return true
    if (selection.kind !== 'fragment-spread') return false
    if (types.some(type => !selection.possibleTypes.includes(type))) return true

    const fragment = resolve(
        fragments,
        selection.sourcePath,
        selection.name,
        selection.location
    )

    return hasTypeSpecificSelections(types, fragment.selections, fragments)
})
