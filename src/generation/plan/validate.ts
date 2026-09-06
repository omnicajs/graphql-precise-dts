import type {
    CompiledField,
    CompiledSelection,
    CompiledTypename,
} from '../model'
import type { FragmentIndex } from './fragments'
import type {
    SchemaTypeRef,
    TypeId,
} from '@/schema/types'

import { invalidDocument } from '../errors'
import { validateSelectionMerge } from '../merge'
import { collectEffectiveSelections } from './effective'

const typenameType: SchemaTypeRef = {
    kind: 'non-null',
    ofType: {
        kind: 'named',
        type: 'String',
    },
}

const renderType = (type: SchemaTypeRef): string => {
    if (type.kind === 'named') return type.type
    if (type.kind === 'list') return `[${renderType(type.ofType)}]`

    return `${renderType(type.ofType)}!`
}

const responseType = (selection: CompiledField | CompiledTypename): SchemaTypeRef => (
    selection.kind === 'typename' ? typenameType : selection.type
)

const hasCompatibleTypeShape = (
    left: SchemaTypeRef,
    right: SchemaTypeRef,
    leftComposite: boolean,
    rightComposite: boolean
): boolean => {
    if (left.kind !== right.kind) return false
    if (left.kind === 'non-null' || left.kind === 'list') {
        return hasCompatibleTypeShape(
            left.ofType,
            (right as typeof left).ofType,
            leftComposite,
            rightComposite
        )
    }

    if (leftComposite || rightComposite) return leftComposite && rightComposite

    return left.type === (right as typeof left).type
}

const effectiveSelections = (
    types: ReadonlyArray<TypeId>,
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): ReadonlyArray<ReadonlyArray<CompiledField | CompiledTypename>> => types.map(type => (
    collectEffectiveSelections(selections, type, fragments)
))

const validateResponseShape = (
    left: CompiledField | CompiledTypename,
    right: CompiledField | CompiledTypename,
    fragments: FragmentIndex
): void => {
    const leftType = responseType(left)
    const rightType = responseType(right)
    const leftComposite = left.kind === 'field' && left.value.kind === 'composite'
    const rightComposite = right.kind === 'field' && right.value.kind === 'composite'

    if (!hasCompatibleTypeShape(leftType, rightType, leftComposite, rightComposite)) {
        return invalidDocument(
            `Selections for response name "${left.name}" have incompatible return types `
                + `"${renderType(leftType)}" and "${renderType(rightType)}"`,
            right.location
        )
    }

    if (left.kind !== 'field'
        || right.kind !== 'field'
        || left.value.kind !== 'composite'
        || right.value.kind !== 'composite') return

    const leftSelections = effectiveSelections(
        left.value.possibleTypes,
        left.value.selections,
        fragments
    )
    const rightSelections = effectiveSelections(
        right.value.possibleTypes,
        right.value.selections,
        fragments
    )

    for (const leftVariant of leftSelections) {
        for (const rightVariant of rightSelections) {
            validateResponseShapes(leftVariant, rightVariant, fragments)
        }
    }
}

const validateResponseShapes = (
    left: ReadonlyArray<CompiledField | CompiledTypename>,
    right: ReadonlyArray<CompiledField | CompiledTypename>,
    fragments: FragmentIndex
): void => {
    for (const leftSelection of left) {
        for (const rightSelection of right) {
            if (rightSelection.name === leftSelection.name) {
                validateResponseShape(leftSelection, rightSelection, fragments)
            }
        }
    }
}

const validateVariantResponseShapes = (
    selections: ReadonlyArray<CompiledField | CompiledTypename>,
    fragments: FragmentIndex
): void => {
    for (const [ index, left ] of selections.entries()) {
        for (const right of selections.slice(index + 1)) {
            if (right.name !== left.name) continue

            validateSelectionMerge(left, right)
            validateResponseShape(left, right, fragments)
        }
    }
}

export const validateSelections = (
    types: ReadonlyArray<TypeId>,
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): void => {
    const variants = effectiveSelections(types, selections, fragments)

    for (const effective of variants) {
        validateVariantResponseShapes(effective, fragments)

        for (const selection of effective) {
            if (selection.kind === 'field' && selection.value.kind === 'composite') {
                validateSelections(
                    selection.value.possibleTypes,
                    selection.value.selections,
                    fragments
                )
            }
        }
    }

    for (const [ index, left ] of variants.entries()) {
        for (const right of variants.slice(index + 1)) {
            validateResponseShapes(left, right, fragments)
        }
    }
}
