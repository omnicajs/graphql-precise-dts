import type {
    CompiledField,
    CompiledFragmentSpread,
    CompiledSelection,
    CompiledTypename,
} from '../model'
import type { FragmentIndex } from './fragments'
import type {
    PlannedField,
    PlannedFragmentSpread,
    PlannedSelection,
    PlannedSelectionSet,
    PlannedSelectionVariant,
    PlannedTypename,
} from './types'
import type { TypeId } from '@/schema/types'
import type { CompiledFragment } from '../model'

import { mergeSelections } from '../merge'
import {
    collectEffectiveSelections,
    hasTypeSpecificSelections,
} from './effective'
import { resolve as resolveFragment } from './fragments'
import { validateCycles } from './cycles'
import { validateSelections } from './validate'

type VariantSelection = CompiledField | CompiledTypename | CompiledFragmentSpread

const withConditional = <TSelection extends CompiledSelection>(
    selection: TSelection,
    inheritedConditional: boolean
): TSelection => inheritedConditional && !selection.conditional
        ? { ...selection, conditional: true }
        : selection

const collectVariantSelections = (
    selections: ReadonlyArray<CompiledSelection>,
    type: TypeId,
    types: ReadonlyArray<TypeId>,
    fragments: FragmentIndex,
    inheritedConditional = false
): ReadonlyArray<VariantSelection> => selections.flatMap(selection => {
    if (!selection.included) return []

    const conditional = inheritedConditional || selection.conditional

    if (selection.kind === 'inline-fragment') {
        return selection.possibleTypes.includes(type)
            ? collectVariantSelections(
                selection.selections,
                type,
                types,
                fragments,
                conditional
            )
            : []
    }
    if (selection.kind === 'fragment-spread') {
        if (!selection.possibleTypes.includes(type)) return []

        const broaderThanContext = selection.possibleTypes.some(
            concreteType => !types.includes(concreteType)
        )
        const fragment = resolveFragment(
            fragments,
            selection.sourcePath,
            selection.name,
            selection.location
        )
        const requiresSpecialization = broaderThanContext
            && hasTypeSpecificSelections(selection.possibleTypes, fragment.selections, fragments)
        if (conditional || requiresSpecialization) {
            return collectVariantSelections(
                fragment.selections,
                type,
                types,
                fragments,
                conditional
            )
        }
    }

    return [ withConditional(selection, inheritedConditional) ]
})

const mergeFragmentSpreads = (
    selections: ReadonlyArray<CompiledSelection>
): ReadonlyArray<CompiledSelection> => {
    const merged: CompiledSelection[] = []
    const indexes = new Map<string, number>()

    for (const selection of selections) {
        if (selection.kind !== 'fragment-spread') {
            merged.push(selection)
            continue
        }

        const key = `${selection.sourcePath}\0${selection.name}`
        const index = indexes.get(key)
        if (index === undefined) {
            indexes.set(key, merged.length)
            merged.push(selection)
            continue
        }

        // The first identical spread already represents the complete selection.
    }

    return merged
}

const mergeVariantSelections = (
    selections: ReadonlyArray<VariantSelection>
): ReadonlyArray<VariantSelection> => mergeFragmentSpreads(
    mergeSelections(selections)
) as ReadonlyArray<VariantSelection>

const planField = (
    field: CompiledField,
    fragments: FragmentIndex
): PlannedField => ({
    kind: 'field',
    name: field.name,
    type: field.type,
    conditional: field.conditional,
    overrideType: field.overrideType,
    value: field.value.kind === 'composite'
        ? {
            kind: 'composite',
            type: field.value.type,
            selectionSet: planSelectionSet(
                field.value.possibleTypes,
                field.value.selections,
                fragments
            ),
        }
        : field.value,
})

const planSelection = (
    selection: VariantSelection,
    fragments: FragmentIndex
): PlannedSelection => {
    if (selection.kind === 'field') return planField(selection, fragments)
    if (selection.kind === 'typename') {
        const planned: PlannedTypename = {
            kind: 'typename',
            name: selection.name,
            conditional: selection.conditional,
            overrideType: selection.overrideType,
        }

        return planned
    }

    const planned: PlannedFragmentSpread = {
        kind: 'fragment-spread',
        name: selection.name,
        sourceId: selection.sourceId,
    }

    return planned
}

const hasCompositeSelection = (
    selections: ReadonlyArray<CompiledField | CompiledTypename>,
    name: string
): boolean => selections.some(selection => selection.kind === 'field'
    && selection.name === name
    && selection.value.kind === 'composite')

const expandCompositeOverlaps = (
    selections: ReadonlyArray<VariantSelection>,
    type: TypeId,
    types: ReadonlyArray<TypeId>,
    fragments: FragmentIndex
): ReadonlyArray<VariantSelection> => {
    let expanded = false
    const result = selections.flatMap((selection, index) => {
        if (selection.kind !== 'fragment-spread') return [ selection ]

        const spreadSelections = collectEffectiveSelections(
            [ selection ],
            type,
            fragments,
            false,
            false
        )
        const otherSelections = collectEffectiveSelections(
            selections.filter((_, candidateIndex) => candidateIndex !== index),
            type,
            fragments,
            false,
            false
        )
        const overlaps = spreadSelections.some(candidate => candidate.kind === 'field'
            && candidate.value.kind === 'composite'
            && hasCompositeSelection(otherSelections, candidate.name))
        if (!overlaps) return [ selection ]

        expanded = true
        const fragment = resolveFragment(
            fragments,
            selection.sourcePath,
            selection.name,
            selection.location
        )

        return collectVariantSelections(fragment.selections, type, types, fragments)
    })

    return expanded
        ? expandCompositeOverlaps(result, type, types, fragments)
        : result
}

const planVariant = (
    types: ReadonlyArray<TypeId>,
    selectedType: TypeId,
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): PlannedSelectionVariant => ({
    types,
    selections: mergeVariantSelections(
        expandCompositeOverlaps(
            collectVariantSelections(selections, selectedType, types, fragments),
            selectedType,
            types,
            fragments
        )
    ).map(selection => planSelection(selection, fragments)),
})

export const planSelectionSet = (
    types: ReadonlyArray<TypeId>,
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex,
    fragmentPath: ReadonlyArray<Pick<CompiledFragment, 'name' | 'sourcePath'>> = []
): PlannedSelectionSet => {
    validateCycles(selections, fragments, fragmentPath)
    validateSelections(types, selections, fragments)

    return {
        variants: hasTypeSpecificSelections(types, selections, fragments)
            ? types.map(type => planVariant([ type ], type, selections, fragments))
            : [ planVariant(types, types[0], selections, fragments) ],
    }
}
