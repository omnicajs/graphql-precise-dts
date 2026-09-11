import type {
    CompiledField,
    CompiledSelection,
    CompiledTypename,
} from '../model'
import type { FragmentIndex } from './fragments'
import type {
    SchemaTypeRef,
} from '@/schema/types'

import { invalidDocument } from '../errors'
import { validateSelectionMerge } from '../merge'
import { resolve } from './fragments'

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

type FieldSelection = CompiledField | CompiledTypename

// Validation follows declared scopes, before concrete-type narrowing or pruning.
const collectFields = (
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): ReadonlyArray<FieldSelection> => selections.flatMap(selection => {
    if (selection.kind === 'inline-fragment') return collectFields(selection.selections, fragments)
    if (selection.kind === 'fragment-spread') {
        const fragment = resolve(fragments, selection.sourcePath, selection.name, selection.location)
        return collectFields(fragment.selections, fragments)
    }
    return selection.kind === 'typename' && selection.implicit ? [] : [selection]
})

const validatePair = (
    left: CompiledField | CompiledTypename,
    right: CompiledField | CompiledTypename,
    fragments: FragmentIndex,
    inheritedExclusive = false
): void => {
    const exclusive = inheritedExclusive || (
        left.parentIsObject && right.parentIsObject && left.parentType !== right.parentType
    )
    if (!exclusive) validateSelectionMerge(left, right)

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

    const leftFields = collectFields(left.value.selections, fragments)
    const rightFields = collectFields(right.value.selections, fragments)
    for (const leftField of leftFields) {
        for (const rightField of rightFields) {
            if (leftField.name === rightField.name) validatePair(leftField, rightField, fragments, exclusive)
        }
    }
}

export const validateSelections = (
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): void => {
    const fields = collectFields(selections, fragments)
    for (const [index, left] of fields.entries()) {
        for (const right of fields.slice(index + 1)) {
            if (left.name === right.name) validatePair(left, right, fragments)
        }
        if (left.kind === 'field' && left.value.kind === 'composite') {
            validateSelections(left.value.selections, fragments)
        }
    }
}
