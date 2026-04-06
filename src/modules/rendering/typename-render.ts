import type { DefinitionNodeModel } from '../../types/models'

import {
    DefinitionNodeKind,
    FieldValueKind,
} from '../../enums/model-kinds'

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
    selections: DefinitionNodeModel[],
    withinConditional = false
): ResolvedTypenameSelection[] => selections.flatMap(selection => {
    const isConditional = withinConditional || !!selection.conditional

    if (selection.kind === DefinitionNodeKind.FIELD) {
        if (selection.value.kind !== FieldValueKind.TYPENAME) return []
        if (selection.name !== '__typename' || selection.responseName !== '__typename') return []

        return [{
            present: true,
            required: !isConditional,
            typeNames: selection.value.typeNames,
        }]
    }

    return selection.kind === DefinitionNodeKind.INLINE_FRAGMENT
        ? collectTypenameSelections(selection.selections, isConditional)
        : []
})

export const resolveTypenameSelection = (
    selections: DefinitionNodeModel[],
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
    selections: DefinitionNodeModel[],
    typeNames: string[]
): boolean => {
    const rootSpreads = selections.filter(
        (selection): selection is Extract<DefinitionNodeModel, { kind: DefinitionNodeKind.FRAGMENT_SPREAD }> =>
            selection.kind === DefinitionNodeKind.FRAGMENT_SPREAD
    )

    return rootSpreads.length > 0 && rootSpreads.every(selection => {
        if (selection.conditional) return false

        const spreadTypeNames = selection.onTypeNames ?? [ selection.onType ]
        return spreadTypeNames.length === typeNames.length
            && spreadTypeNames.every((typeName, index) => typeName === typeNames[index])
    })
}
