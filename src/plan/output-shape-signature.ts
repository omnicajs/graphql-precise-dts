import type {
    FieldValue,
    SelectionModel,
    TypeRef,
} from '../models/types'
import type { ObjectRenderOptions } from './document-models-types'

import { normalizeSelections } from '../render/selection-normalization'
import { renderTsType } from '../ts-type'

import {
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../models/kinds'

type OutputSignatureState = {
    inProgressObjects: WeakSet<object>;
}

const makeTypeRefShapeSignature = (typeRef: TypeRef): string => {
    switch (typeRef.kind) {
        case TYPE_REF_KIND.NAMED:
            return `named:${typeRef.name}`
        case TYPE_REF_KIND.LIST:
            return `list:${makeTypeRefShapeSignature(typeRef.ofType)}`
        case TYPE_REF_KIND.NON_NULL:
            return `nonnull:${makeTypeRefShapeSignature(typeRef.ofType)}`
    }
}

const makeSelectionsShapeSignature = (
    selections: SelectionModel[],
    options: ObjectRenderOptions,
    state: OutputSignatureState
): string => normalizeSelections(selections)
    .map(selection => makeSelectionShapeSignature(selection, state))
    .join('|') + [
    options.requiredFallbackTypename ? 'required-fallback-typename' : '',
    options.dedupeTypenameWithSpread ? 'dedupe-spread-typename' : '',
    options.dedupeTypenameWithAlias ? 'dedupe-alias-typename' : '',
].filter(Boolean).join('|')

const makeSelectionShapeSignature = (
    selection: SelectionModel,
    state: OutputSignatureState
): string => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD:
            return [
                'field',
                selection.name,
                selection.responseName,
                selection.argumentsSignature,
                selection.conditional ? 'conditional' : 'required',
                makeTypeRefShapeSignature(selection.typeRef),
                selection.overrideTypeTs ? `override:${renderTsType(selection.overrideTypeTs)}` : 'override:none',
                makeFieldValueShapeSignature(selection.value, state),
            ].join(':')
        case SELECTION_MODEL_KIND.FRAGMENT_SPREAD:
            return [
                'spread',
                selection.name,
                selection.onType,
                selection.conditional ? 'conditional' : 'required',
            ].join(':')
        case SELECTION_MODEL_KIND.INLINE_FRAGMENT:
            return [
                'inline',
                selection.typeCondition ?? '',
                selection.conditional ? 'conditional' : 'required',
                makeSelectionsShapeSignature(selection.selections, {}, state),
            ].join(':')
    }
}

const makeFieldValueShapeSignature = (
    value: FieldValue,
    state: OutputSignatureState
): string => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return `scalar:${renderTsType(value.typeTs)}`
        case VALUE_MODEL_KIND.TYPENAME:
            return `typename:${[ ...value.typeNames ].sort().join('|')}`
        case VALUE_MODEL_KIND.ENUM:
            return `enum:${value.name}`
        case VALUE_MODEL_KIND.OBJECT: {
            if (state.inProgressObjects.has(value)) {
                return `recursive-object:${[ ...(value.typeNames ?? []) ].sort().join('|') || 'anonymous'}`
            }

            state.inProgressObjects.add(value)
            const signature = [
                `object:${[ ...(value.typeNames ?? []) ].sort().join('|')}`,
                makeSelectionsShapeSignature(
                    value.fields,
                    {
                        dedupeTypenameWithSpread: true,
                        dedupeTypenameWithAlias: (value.typeNames?.length ?? 0) === 1,
                    },
                    state
                ),
            ].join(':')
            state.inProgressObjects.delete(value)
            return signature
        }
        case VALUE_MODEL_KIND.UNION:
            return `union:${value.variants
                .map(variant => `${variant.typeName}:${makeSelectionsShapeSignature(variant.fields, {}, state)}`)
                .sort()
                .join('|')}`
        default:
            return `unknown:${value.reason}`
    }
}

const makeOutputSignatureState = (): OutputSignatureState => ({
    inProgressObjects: new WeakSet(),
})

export const makeOutputShapeSignature = (
    fields: SelectionModel[],
    typeNames: string[],
    options: ObjectRenderOptions
): string => [
    `types:${[ ...typeNames ].sort().join('|')}`,
    makeSelectionsShapeSignature(fields, options, makeOutputSignatureState()),
].join('::')
