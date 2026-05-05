import type {
    ObjectRenderOptions,
    PlannedFieldValue,
    PlannedSelectionModel,
} from '../planned-types'

import type {
    RenderableFieldValue,
    RenderableObjectShape,
    RenderableSelectionSet,
    RenderableUnionShape,
} from './types'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../kinds'

type ResolvedTypenameSelection = {
    present: boolean;
    required: boolean;
    typeNames: string[];
}

type RenderableVariantSelectionSet = RenderableSelectionSet & {
    typeName: string;
    hasExplicitTypename: boolean;
    hasRequiredExplicitTypename: boolean;
}

const uniqueTypeNames = (typeNames: string[]): string[] => [ ...new Set(typeNames) ]

const haveSameTypeNames = (left: string[], right: string[]): boolean => {
    const uniqueLeft = uniqueTypeNames(left)
    const uniqueRight = uniqueTypeNames(right)

    return uniqueLeft.length === uniqueRight.length
        && uniqueLeft.every(typeName => uniqueRight.includes(typeName))
}

const collectTypenameSelections = (
    selections: PlannedSelectionModel[]
): ResolvedTypenameSelection[] => selections.flatMap(selection => {
    if (selection.kind === SELECTION_MODEL_KIND.FIELD) {
        if (selection.value.kind !== VALUE_MODEL_KIND.TYPENAME) return []
        if (selection.name !== '__typename' || selection.responseName !== '__typename') return []

        return [{
            present: true,
            required: !selection.conditional,
            typeNames: selection.value.typeNames,
        }]
    }

    return []
})

const collectAliasedTypenameSelections = (
    selections: PlannedSelectionModel[]
): boolean[] => selections.flatMap(selection => {
    if (selection.kind === SELECTION_MODEL_KIND.FIELD) {
        return selection.value.kind === VALUE_MODEL_KIND.TYPENAME
            && selection.name === '__typename'
            && selection.responseName !== '__typename'
            && !selection.conditional
            ? [ true ]
            : []
    }

    return []
})

const prepareFieldValue = (value: PlannedFieldValue): RenderableFieldValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.OBJECT:
            return {
                kind: VALUE_MODEL_KIND.OBJECT,
                renderAliasName: value.renderAliasName,
                renderAsReference: value.renderAsReference,
                ...(value.renderAsReference && value.renderAliasName
                    ? {}
                    : {
                        shape: prepareObjectShape(value.fields, value.typeNames ?? [], value.renderOptions),
                    }),
            }
        case VALUE_MODEL_KIND.UNION:
            return {
                kind: VALUE_MODEL_KIND.UNION,
                shape: prepareUnionShape(value.variants),
            }
        default:
            return value
    }
}

const prepareSelectionSet = (
    selections: PlannedSelectionModel[]
) : RenderableSelectionSet => selections.reduce<RenderableSelectionSet>((result, selection) => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD:
            if (selection.name === '__typename' && selection.responseName === '__typename') {
                return result
            }

            result.rows.push({
                name: selection.responseName,
                typeRef: selection.typeRef,
                conditional: selection.conditional,
                value: prepareFieldValue(selection.value),
                overrideTypeTs: selection.overrideTypeTs,
            })
            return result
        case SELECTION_MODEL_KIND.FRAGMENT_SPREAD:
            result.spreads.push({
                name: selection.name,
                conditional: selection.conditional,
            })
            return result
    }
}, {
    rows: [],
    spreads: [],
})

export const resolveTypenameSelection = (
    selections: PlannedSelectionModel[],
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
    selections: PlannedSelectionModel[],
    typeNames: string[]
): boolean => {
    const rootSpreads = selections.filter(
        (selection): selection is Extract<PlannedSelectionModel, { kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD }> =>
            selection.kind === SELECTION_MODEL_KIND.FRAGMENT_SPREAD
    )

    return rootSpreads.length > 0 && rootSpreads.every(selection => {
        if (selection.conditional) return false

        const spreadTypeNames = selection.onTypeNames ?? [ selection.onType ]
        return spreadTypeNames.length === typeNames.length
            && spreadTypeNames.every((typeName, index) => typeName === typeNames[index])
    })
}

export const hasAliasedRootTypenameSelection = (
    selections: PlannedSelectionModel[]
): boolean => collectAliasedTypenameSelections(selections).length > 0

export const hasSameRenderableSelectionSet = (
    left: RenderableSelectionSet,
    right: RenderableSelectionSet
): boolean => JSON.stringify({
    rows: left.rows,
    spreads: left.spreads,
}) === JSON.stringify({
    rows: right.rows,
    spreads: right.spreads,
})

export const prepareObjectShape = (
    fields: PlannedSelectionModel[],
    typeNames: string[],
    options: ObjectRenderOptions = {}
): RenderableObjectShape => {
    const fallbackTypeNames = typeNames.filter(Boolean)
    const preparedSelections = prepareSelectionSet(fields)
    const resolvedTypename = resolveTypenameSelection(fields, fallbackTypeNames)
    const shouldOmitFallbackTypename = (
        options.dedupeTypenameWithSpread
        && hasRootSpreadWithSameTypeNames(fields, fallbackTypeNames)
    ) || (
        options.dedupeTypenameWithAlias
        && hasAliasedRootTypenameSelection(fields)
    )

    return {
        ...preparedSelections,
        ...(resolvedTypename.present
            ? {
                typename: {
                    typeNames: resolvedTypename.typeNames,
                    required: resolvedTypename.required,
                },
            }
            : fallbackTypeNames.length === 0 || shouldOmitFallbackTypename
                ? {}
                : {
                    typename: {
                        typeNames: fallbackTypeNames,
                        required: !!options.requiredFallbackTypename,
                    },
                }),
    }
}

export const prepareUnionShape = (
    variants: Extract<PlannedFieldValue, { kind: typeof VALUE_MODEL_KIND.UNION }>['variants']
): RenderableUnionShape => {
    const preparedVariants = variants.map((variant): RenderableVariantSelectionSet => {
        const selections = prepareSelectionSet(variant.fields)
        const resolvedTypename = resolveTypenameSelection(variant.fields)

        return {
            ...selections,
            typeName: variant.typeName,
            hasExplicitTypename: resolvedTypename.present,
            hasRequiredExplicitTypename: resolvedTypename.present && resolvedTypename.required,
        }
    })

    if (preparedVariants.length < 1) {
        return {
            kind: 'variants',
            variants: [],
        }
    }

    const [ firstVariant ] = preparedVariants
    const hasSameShape = preparedVariants.every(variant => hasSameRenderableSelectionSet(firstVariant, variant))
    const hasExplicitTypename = preparedVariants.some(variant => variant.hasExplicitTypename)

    if (hasSameShape) {
        return {
            kind: 'collapsed',
            typename: {
                typeNames: preparedVariants.map(variant => variant.typeName),
                required: !hasExplicitTypename
                    || preparedVariants.every(variant => variant.hasRequiredExplicitTypename),
            },
            rows: firstVariant.rows,
            spreads: firstVariant.spreads,
        }
    }

    return {
        kind: 'variants',
        variants: variants.map(variant =>
            prepareObjectShape(
                variant.fields,
                [ variant.typeName ],
                { requiredFallbackTypename: !hasExplicitTypename }
            )
        ),
    }
}
