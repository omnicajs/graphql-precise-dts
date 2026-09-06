import type {
    CompiledField,
    CompiledSelection,
    CompiledTypename,
} from '../model'
import type { FragmentIndex } from './fragments'
import type { TypeId } from '@/schema/types'

import { resolve } from './fragments'

export type EffectiveSelection = CompiledField | CompiledTypename

const withConditional = <TSelection extends EffectiveSelection>(
    selection: TSelection,
    inheritedConditional: boolean
): TSelection => inheritedConditional && !selection.conditional
        ? { ...selection, conditional: true }
        : selection

export const collectEffectiveSelections = (
    selections: ReadonlyArray<CompiledSelection>,
    type: TypeId,
    fragments: FragmentIndex,
    inheritedConditional = false,
    includeExcluded = true
): ReadonlyArray<EffectiveSelection> => selections.flatMap(selection => {
    if (!includeExcluded && !selection.included) return []

    const conditional = inheritedConditional || selection.conditional

    if (selection.kind === 'inline-fragment') {
        return selection.possibleTypes.includes(type)
            ? collectEffectiveSelections(
                selection.selections,
                type,
                fragments,
                conditional,
                includeExcluded
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
            fragments,
            conditional,
            includeExcluded
        )
    }

    return [ withConditional(selection, inheritedConditional) ]
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
