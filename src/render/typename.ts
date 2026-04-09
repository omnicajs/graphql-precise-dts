import type { SelectionModel } from '../models/types'

import {
    SelectionModelKind,
    ValueModelKind,
} from '../models/kinds'

export type ResolvedTypenameSelection = {
    present: boolean;
    required: boolean;
    typeNames: string[];
}

const uniqueTypeNames = (typeNames: string[]): string[] => [ ...new Set(typeNames) ]

const haveSameTypeNames = (left: string[], right: string[]): boolean => {
    const uniqueLeft = uniqueTypeNames(left)
    const uniqueRight = uniqueTypeNames(right)

    return uniqueLeft.length === uniqueRight.length
        && uniqueLeft.every(typeName => uniqueRight.includes(typeName))
}

const collectTypenameSelections = (
    selections: SelectionModel[],
    withinConditional = false
): ResolvedTypenameSelection[] => selections.flatMap(selection => {
    const isConditional = withinConditional || !!selection.conditional

    if (selection.kind === SelectionModelKind.FIELD) {
        if (selection.value.kind !== ValueModelKind.TYPENAME) return []
        if (selection.name !== '__typename' || selection.responseName !== '__typename') return []

        return [{
            present: true,
            required: !isConditional,
            typeNames: selection.value.typeNames,
        }]
    }

    return selection.kind === SelectionModelKind.INLINE_FRAGMENT
        ? collectTypenameSelections(selection.selections, isConditional)
        : []
})

export const resolveTypenameSelection = (
    selections: SelectionModel[],
    fallbackTypeNames: string[] = []
): ResolvedTypenameSelection => {
    const typenameSelections = collectTypenameSelections(selections)
    if (!typenameSelections.length) {
        return {
            present: false,
            required: false,
            typeNames: [],
        }
    }

    const selectionTypeNames = uniqueTypeNames(typenameSelections.flatMap(selection => selection.typeNames))
    const resolvedTypeNames = fallbackTypeNames.length ? uniqueTypeNames(fallbackTypeNames) : selectionTypeNames
    const requiredTypeNames = uniqueTypeNames(
        typenameSelections
            .filter(selection => selection.required)
            .flatMap(selection => selection.typeNames)
    )

    return {
        present: true,
        required: resolvedTypeNames.length > 0 && haveSameTypeNames(requiredTypeNames, resolvedTypeNames),
        typeNames: resolvedTypeNames,
    }
}

export const hasRootSpreadWithSameTypeNames = (
    selections: SelectionModel[],
    typeNames: string[]
): boolean => {
    const rootSpreads = selections.filter(
        (selection): selection is Extract<SelectionModel, { kind: SelectionModelKind.FRAGMENT_SPREAD }> =>
            selection.kind === SelectionModelKind.FRAGMENT_SPREAD
    )

    return rootSpreads.length > 0 && rootSpreads.every(selection => {
        if (selection.conditional) return false

        const spreadTypeNames = selection.onTypeNames ?? [ selection.onType ]
        return spreadTypeNames.length === typeNames.length
            && spreadTypeNames.every((typeName, index) => typeName === typeNames[index])
    })
}
