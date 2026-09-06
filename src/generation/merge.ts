import type {
    CompiledField,
    CompiledSelection,
    CompiledTypename,
} from './model'

import { invalidDocument } from './errors'

type MergeableSelection = CompiledField | CompiledTypename

type SelectionPresence = Pick<MergeableSelection, 'conditional' | 'included'>

const isMergeableSelection = (
    selection: CompiledSelection
): selection is MergeableSelection => selection.kind === 'field' || selection.kind === 'typename'

const applyParentPresence = (
    selections: ReadonlyArray<CompiledSelection>,
    parent: SelectionPresence
): ReadonlyArray<CompiledSelection> => selections.map(selection => ({
    ...selection,
    included: parent.included && selection.included,
    conditional: parent.conditional || selection.conditional,
}))

const mergePresence = (
    existing: SelectionPresence,
    duplicate: SelectionPresence
): SelectionPresence => ({
    included: existing.included || duplicate.included,
    conditional: existing.included && duplicate.included
        ? existing.conditional && duplicate.conditional
        : existing.included
            ? existing.conditional
            : duplicate.included
                ? duplicate.conditional
                : false,
})

const mergeFields = (
    existing: CompiledField,
    duplicate: CompiledField
): CompiledField => {
    const presence = mergePresence(existing, duplicate)

    if (existing.value.kind !== 'composite' || duplicate.value.kind !== 'composite') {
        return {
            ...existing,
            ...presence,
        }
    }

    const existingValue = existing.value
    const duplicateValue = duplicate.value
    const possibleTypes = existingValue.possibleTypes.filter(
        type => duplicateValue.possibleTypes.includes(type)
    )
    const duplicateIsNarrower = duplicateValue.possibleTypes.length < existingValue.possibleTypes.length
        && duplicateValue.possibleTypes.every(type => existingValue.possibleTypes.includes(type))
    const narrowed = duplicateIsNarrower ? duplicate : existing
    const narrowedValue = duplicateIsNarrower ? duplicateValue : existingValue

    return {
        ...existing,
        ...presence,
        type: narrowed.type,
        value: {
            ...narrowedValue,
            possibleTypes,
            selections: mergeSelections([
                ...applyParentPresence(existingValue.selections, existing),
                ...applyParentPresence(duplicateValue.selections, duplicate),
            ]),
        },
    }
}

export const validateSelectionMerge = (
    existing: MergeableSelection,
    duplicate: MergeableSelection
): void => {
    if (existing.field !== duplicate.field) {
        return invalidDocument(
            `Selections for response name "${existing.name}" target different fields "${existing.field}" and "${duplicate.field}"`,
            duplicate.location
        )
    }
    if (existing.argumentsSignature !== duplicate.argumentsSignature) {
        return invalidDocument(
            `Selections for response name "${existing.name}" provide different arguments`,
            duplicate.location
        )
    }
    if (existing.kind === 'typename' && (existing.implicit || (duplicate as CompiledTypename).implicit)) return

    if (existing.overrideType !== duplicate.overrideType) {
        return invalidDocument(
            `Selections for response name "${existing.name}" have different override types`,
            duplicate.location
        )
    }
    if (existing.forceNonNull !== duplicate.forceNonNull) {
        return invalidDocument(
            `Selections for response name "${existing.name}" have different nullability`,
            duplicate.location
        )
    }
}

const mergeSelection = (
    existing: MergeableSelection,
    duplicate: MergeableSelection
): MergeableSelection => {
    validateSelectionMerge(existing, duplicate)

    if (existing.kind === 'typename') {
        return {
            ...(existing.implicit ? duplicate as CompiledTypename : existing),
            implicit: existing.implicit && (duplicate as CompiledTypename).implicit,
            ...mergePresence(existing, duplicate),
        }
    }

    return mergeFields(existing, duplicate as CompiledField)
}

export const mergeSelections = (
    selections: ReadonlyArray<CompiledSelection>
): ReadonlyArray<CompiledSelection> => {
    const merged: CompiledSelection[] = []
    const indexes = new Map<string, number>()

    for (const selection of selections) {
        if (!isMergeableSelection(selection)) {
            merged.push(selection)
            continue
        }

        const index = indexes.get(selection.name)
        if (index === undefined) {
            indexes.set(selection.name, merged.length)
            merged.push(selection)
            continue
        }

        merged[index] = mergeSelection(merged[index] as MergeableSelection, selection)
    }

    return merged
}
