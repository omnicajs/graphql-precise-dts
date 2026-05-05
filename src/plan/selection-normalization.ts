import type {
    FieldSelectionModel,
    FieldValue,
    FragmentSpreadSelectionModel,
    SelectionModel,
    TypeRef,
} from '../models/types'

import {
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../kinds'

export type NormalizedSelectionModel = FieldSelectionModel | FragmentSpreadSelectionModel

type FieldValueMergeContext = {
    existingSelection: FieldSelectionModel;
    duplicateSelection: FieldSelectionModel;
}

type FieldValueMergeHandler<TKind extends FieldValue['kind']> = (
    left: Extract<FieldValue, { kind: TKind }>,
    right: Extract<FieldValue, { kind: TKind }>,
    context: FieldValueMergeContext
) => FieldValue

type FieldValueMergers = {
    [TKind in FieldValue['kind']]: FieldValueMergeHandler<TKind>;
}

const uniqueValues = <T>(values: T[]): T[] => [ ...new Set(values) ]

const formatDiagnosticLocation = (location?: string): string =>
    location ? `"${location}"` : 'an unknown location'

const makeSelectionConflictError = (
    existingSelection: FieldSelectionModel,
    duplicateSelection: FieldSelectionModel,
    reason: string
): Error => new Error(
    `Conflicting selections for response name "${existingSelection.responseName}" at ${formatDiagnosticLocation(existingSelection.diagnosticLocation)} and ${formatDiagnosticLocation(duplicateSelection.diagnosticLocation)}: ${reason}.`
)

const hasSameTypeRef = (left: TypeRef, right: TypeRef): boolean => {
    if (left.kind !== right.kind) return false

    switch (left.kind) {
        case TYPE_REF_KIND.NAMED:
            return left.name === (right as typeof left).name
        case TYPE_REF_KIND.LIST:
        case TYPE_REF_KIND.NON_NULL:
            return hasSameTypeRef(left.ofType, (right as typeof left).ofType)
    }
}

const mergeDiagnosticLocations = (...locations: Array<string | undefined>): string | undefined =>
    uniqueValues(locations.filter((location): location is string => !!location)).join(', ') || undefined

const mergeConditionalFlag = <T extends boolean>(left: T, right: T): T => left && right

const mergeDirectiveLists = <T extends string>(left: T[] = [], right: T[] = []): T[] => uniqueValues([ ...left, ...right ])

const fieldValueMergers: FieldValueMergers = {
    [VALUE_MODEL_KIND.SCALAR]: (left, right, { existingSelection, duplicateSelection }) => {
        if (left.name === right.name && left.usage === right.usage) {
            return left
        }

        const leftLabel = `${left.name}:${left.usage}`
        const rightLabel = `${right.name}:${right.usage}`

        throw makeSelectionConflictError(
            existingSelection,
            duplicateSelection,
            `different scalar result definitions "${leftLabel}" and "${rightLabel}" cannot be merged`
        )
    },
    [VALUE_MODEL_KIND.ENUM]: (left, right, { existingSelection, duplicateSelection }) => {
        if (left.name !== right.name) {
            throw makeSelectionConflictError(
                existingSelection,
                duplicateSelection,
                `different enum result types "${left.name}" and "${right.name}" cannot be merged`
            )
        }

        return left
    },
    [VALUE_MODEL_KIND.TYPENAME]: (left, right) => ({
        kind: VALUE_MODEL_KIND.TYPENAME,
        typeNames: uniqueValues([ ...left.typeNames, ...right.typeNames ]),
    }),
    [VALUE_MODEL_KIND.OBJECT]: (left, right) => ({
        kind: VALUE_MODEL_KIND.OBJECT,
        fields: normalizeSelections([ ...left.fields, ...right.fields ]),
        typeNames: uniqueValues([ ...(left.typeNames ?? []), ...(right.typeNames ?? []) ]),
    }),
    [VALUE_MODEL_KIND.UNION]: (left, right) => {
        const variants = new Map(left.variants.map(variant => [ variant.typeName, variant ]))

        right.variants.forEach(variant => {
            const existingVariant = variants.get(variant.typeName)

            if (!existingVariant) {
                variants.set(variant.typeName, variant)
                return
            }

            variants.set(variant.typeName, {
                typeName: variant.typeName,
                fields: normalizeSelections([ ...existingVariant.fields, ...variant.fields ]),
            })
        })

        return {
            kind: VALUE_MODEL_KIND.UNION,
            variants: [ ...variants.values() ],
        }
    },
    [VALUE_MODEL_KIND.UNKNOWN]: (left, right, { existingSelection, duplicateSelection }) => {
        if (left.reason !== right.reason) {
            throw makeSelectionConflictError(
                existingSelection,
                duplicateSelection,
                `different unknown result reasons cannot be merged`
            )
        }

        return left
    },
}

const mergeFieldValues = (
    existingSelection: FieldSelectionModel,
    duplicateSelection: FieldSelectionModel
): FieldValue => {
    const left = existingSelection.value
    const right = duplicateSelection.value

    if (left.kind !== right.kind) {
        throw makeSelectionConflictError(
            existingSelection,
            duplicateSelection,
            `different result shapes "${left.kind}" and "${right.kind}" cannot be merged`
        )
    }

    const mergeFieldValue = fieldValueMergers[left.kind] as FieldValueMergeHandler<typeof left.kind>

    return mergeFieldValue(left, right as typeof left, {
        existingSelection,
        duplicateSelection,
    })
}

const mergeFragmentSpreads = (
    existingSelection: FragmentSpreadSelectionModel,
    duplicateSelection: FragmentSpreadSelectionModel
): FragmentSpreadSelectionModel => {
    const existingTypeNames = existingSelection.onTypeNames ?? [ existingSelection.onType ]
    const duplicateTypeNames = duplicateSelection.onTypeNames ?? [ duplicateSelection.onType ]

    if (existingSelection.onType !== duplicateSelection.onType
        || existingTypeNames.length !== duplicateTypeNames.length
        || existingTypeNames.some((typeName, index) => typeName !== duplicateTypeNames[index])) {
        throw new Error(
            `Conflicting fragment spreads "${existingSelection.name}" at ${formatDiagnosticLocation(existingSelection.diagnosticLocation)} and ${formatDiagnosticLocation(duplicateSelection.diagnosticLocation)} cannot be merged.`
        )
    }

    const directiveNames = mergeDirectiveLists(existingSelection.directiveNames, duplicateSelection.directiveNames)
    return {
        ...existingSelection,
        diagnosticLocation: mergeDiagnosticLocations(existingSelection.diagnosticLocation, duplicateSelection.diagnosticLocation),
        conditional: mergeConditionalFlag(existingSelection.conditional, duplicateSelection.conditional),
        ...(directiveNames.length ? { directiveNames } : {}),
    }
}

const mergeFieldSelections = (
    existingSelection: FieldSelectionModel,
    duplicateSelection: FieldSelectionModel
): FieldSelectionModel => {
    if (existingSelection.name !== duplicateSelection.name) {
        throw makeSelectionConflictError(
            existingSelection,
            duplicateSelection,
            `different target fields "${existingSelection.name}" and "${duplicateSelection.name}" cannot be merged`
        )
    } else if (existingSelection.argumentsSignature !== duplicateSelection.argumentsSignature) {
        throw makeSelectionConflictError(
            existingSelection,
            duplicateSelection,
            `different field arguments cannot be merged`
        )
    } else if (!hasSameTypeRef(existingSelection.typeRef, duplicateSelection.typeRef)) {
        throw makeSelectionConflictError(
            existingSelection,
            duplicateSelection,
            `different field nullability or list structure cannot be merged`
        )
    }

    const directiveNames = mergeDirectiveLists(existingSelection.directiveNames, duplicateSelection.directiveNames)
    return {
        ...existingSelection,
        diagnosticLocation: mergeDiagnosticLocations(existingSelection.diagnosticLocation, duplicateSelection.diagnosticLocation),
        conditional: mergeConditionalFlag(existingSelection.conditional, duplicateSelection.conditional),
        ...(directiveNames.length ? { directiveNames } : {}),
        value: mergeFieldValues(
            existingSelection,
            duplicateSelection
        ),
    }
}

const flattenSelections = (
    selections: SelectionModel[],
    withinConditional = false
): NormalizedSelectionModel[] => selections.flatMap(selection => {
    const conditional = withinConditional || selection.conditional

    if (selection.kind === SELECTION_MODEL_KIND.INLINE_FRAGMENT) {
        return flattenSelections(selection.selections, conditional)
    }

    return [{
        ...selection,
        conditional,
    }]
})

export const normalizeSelections = (
    selections: SelectionModel[]
): NormalizedSelectionModel[] => {
    const normalizedSelections: NormalizedSelectionModel[] = []
    const fieldsByResponseName = new Map<string, number>()
    const spreadsByName = new Map<string, number>()

    flattenSelections(selections).forEach(selection => {
        if (selection.kind === SELECTION_MODEL_KIND.FIELD) {
            const existingIndex = fieldsByResponseName.get(selection.responseName)
            if (existingIndex === undefined) {
                fieldsByResponseName.set(selection.responseName, normalizedSelections.push(selection) - 1)
                return
            }

            normalizedSelections[existingIndex] = mergeFieldSelections(
                normalizedSelections[existingIndex] as FieldSelectionModel,
                selection
            )
            return
        }

        const existingIndex = spreadsByName.get(selection.name)

        if (existingIndex === undefined) {
            spreadsByName.set(selection.name, normalizedSelections.push(selection) - 1)
            return
        }

        normalizedSelections[existingIndex] = mergeFragmentSpreads(
            normalizedSelections[existingIndex] as FragmentSpreadSelectionModel,
            selection
        )
    })

    return normalizedSelections
}
