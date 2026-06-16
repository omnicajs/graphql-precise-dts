import type { ModelContext } from './types/context'
import type { ScalarUsage } from '../scalars/types'
import type { SelectionModel } from './types/selection'

import type {
    TypeFieldNode,
    TypeSelectionNode,
} from './selection'

import type {
    FieldValue,
    ScalarValue,
    VariableValue,
} from './types/value'

import type {
    FieldNode,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
    SelectionNode,
} from 'graphql'

import { GraphQLObjectType } from 'graphql'

import { isUndefined } from '../lib/predicates'
import {
    filterSelectionsForConcreteType,
    makeTypeRefForVariable,
    shouldBuildTypeSelectionUnion,
    specializeTypenameSelections,
} from './resolve'

import {
    getNamedType,
    isEnumType,
    isInterfaceType,
    isNullableType,
    isObjectType,
    isScalarType,
} from 'graphql'

import {
    makeSelectionModels,
    makeSelectionsForFields,
} from './selections-builder'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../kinds'
import { Kind } from 'graphql'

const makeScalarValue = (
    typeName: string,
    usage: ScalarUsage = 'output'
): ScalarValue => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    name: typeName,
    usage,
})

const makeEnumFieldValue = (
    typeName: string
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.ENUM }> => ({
    kind: VALUE_MODEL_KIND.ENUM,
    name: typeName,
})

const makeInterfaceUnionFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode>,
    interfaceType: GraphQLInterfaceType,
    selections: readonly SelectionNode[],
    context: ModelContext,
    diagnosticOwner: string
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.UNION }> => ({
    kind: VALUE_MODEL_KIND.UNION,
    variants: context.schema.getPossibleTypes(interfaceType).map(possibleType => ({
        typeName: possibleType.name,
        fields: specializeTypenameSelections(
            makeSelectionModels(
                filterSelectionsForConcreteType(context.schema, possibleType, [ ...selections ]),
                typeSelections,
                context,
                diagnosticOwner
            ),
            possibleType.name
        ),
    })),
})

const makeInterfaceObjectFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    interfaceType: GraphQLInterfaceType,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext,
    diagnosticOwner: string
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> => ({
    kind: VALUE_MODEL_KIND.OBJECT,
    typeNames: context.schema.getPossibleTypes(interfaceType).map(possibleType => possibleType.name),
    fields: makeSelectionsForFields(selections, typeSelections, context, diagnosticOwner),
})

const makeInterfaceFieldValue = (
    type: TypeFieldNode,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext,
    diagnosticOwner: string
): FieldValue => {
    const interfaceType = getNamedType(type.currentType) as GraphQLInterfaceType

    if (selections && type.selections && shouldBuildTypeSelectionUnion(
        interfaceType,
        [ ...selections ],
        context.structuralDirectivePolicies
    )) {
        return makeInterfaceUnionFieldValue(type.selections, interfaceType, selections, context, diagnosticOwner)
    }

    return makeInterfaceObjectFieldValue(type.selections, interfaceType, selections, context, diagnosticOwner)
}

const makeObjectFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    objectType: GraphQLObjectType,
    context: ModelContext,
    diagnosticOwner: string
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> => ({
    kind: VALUE_MODEL_KIND.OBJECT,
    typeNames: [ objectType.name ],
    fields: makeSelectionsForFields(selections, typeSelections, context, diagnosticOwner),
})

const isInlineFragmentTypeSelection = (
    typedSelection: TypeSelectionNode | undefined
): typedSelection is Extract<
    TypeSelectionNode,
    { kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT }
> => typedSelection?.kind === SELECTION_MODEL_KIND.INLINE_FRAGMENT

const makeUnionFieldVariant = (
    selection: SelectionNode,
    typedSelection: TypeSelectionNode | undefined,
    context: ModelContext,
    diagnosticOwner: string
): { typeName: string; fields: SelectionModel[] } | undefined => {
    if (selection.kind !== Kind.INLINE_FRAGMENT) return
    /* v8 ignore next -- @preserve Union variants are built from inline fragment type selections. */
    if (!isInlineFragmentTypeSelection(typedSelection)) return

    const typeName = selection.typeCondition?.name.value ?? typedSelection.typeCondition
    if (!typeName) return

    return {
        typeName,
        fields: makeSelectionModels(
            [ ...selection.selectionSet.selections ],
            typedSelection.selections,
            context,
            diagnosticOwner
        ),
    }
}

const makeUnionFieldVariants = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext,
    diagnosticOwner: string
): Array<{ typeName: string; fields: SelectionModel[] }> => {
    /* v8 ignore next -- @preserve Valid composite GraphQL fields include a selection set; this is a defensive fallback for incomplete AST input. */
    if (!selections) return []

    return selections
        .map(selection => makeUnionFieldVariant(selection, typeSelections?.get(selection), context, diagnosticOwner))
        .filter(selection => selection !== undefined)
}

const makeUnionFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext,
    diagnosticOwner: string
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.UNION }> => ({
    kind: VALUE_MODEL_KIND.UNION,
    variants: makeUnionFieldVariants(typeSelections, selections, context, diagnosticOwner),
})

const makeTypeNameFieldValue = (
    type: TypeFieldNode,
    field: FieldNode
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.TYPENAME }> | undefined => {
    if (field.name.value !== '__typename' || !type.typeNames?.length) return

    return {
        kind: VALUE_MODEL_KIND.TYPENAME,
        typeNames: type.typeNames,
    }
}

export const makeFieldValue = (
    type: TypeFieldNode,
    field: FieldNode,
    context: ModelContext,
    diagnosticOwner = 'selection set'
): FieldValue => {
    const namedType = getNamedType(type.currentType)
    const typeNameValue = makeTypeNameFieldValue(type, field)
    const selections = field.selectionSet?.selections

    if (typeNameValue) return typeNameValue

    if (isScalarType(namedType)) return makeScalarValue(namedType.name)
    if (isEnumType(namedType)) return makeEnumFieldValue(namedType.name)
    if (isInterfaceType(namedType)) return makeInterfaceFieldValue(type, selections, context, diagnosticOwner)
    if (isObjectType(namedType)) {
        return makeObjectFieldValue(type.selections, selections, namedType, context, diagnosticOwner)
    }

    return makeUnionFieldValue(type.selections, selections, context, diagnosticOwner)
}

export const makeVariableValue = (
    type: GraphQLInputType
): VariableValue => buildVariableValue(type, {
    inProgress: new Set(),
    cache: new Map(),
})

const buildVariableValue = (
    type: GraphQLInputType,
    state: {
        inProgress: Set<string>;
        cache: Map<string, Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>;
    }
): VariableValue => {
    const namedType = getNamedType(type)

    if (isScalarType(namedType)) {
        return makeScalarValue(namedType.name, 'input')
    }

    if (isEnumType(namedType)) {
        return { kind: VALUE_MODEL_KIND.ENUM, name: namedType.name }
    }

    return buildVariableObjectValue(namedType as GraphQLInputObjectType, state)
}

const buildVariableObjectValue = (
    namedType: GraphQLInputObjectType,
    state: {
        inProgress: Set<string>;
        cache: Map<string, Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>;
    }
): Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> => {
    const cached = state.cache.get(namedType.name)
    if (cached) return cached

    if (state.inProgress.has(namedType.name)) {
        return {
            kind: VALUE_MODEL_KIND.OBJECT,
            typeName: namedType.name,
            fields: [],
            isRecursiveReference: true,
        }
    }

    state.inProgress.add(namedType.name)

    const value: Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> = {
        kind: VALUE_MODEL_KIND.OBJECT,
        typeName: namedType.name,
        fields: Object.values(namedType.getFields()).map(field => ({
            name: field.name,
            typeRef: makeTypeRefForVariable(field.type),
            optional: isNullableType(field.type) || !isUndefined(field.defaultValue),
            value: buildVariableValue(field.type, state),
        })),
    }

    state.inProgress.delete(namedType.name)
    state.cache.set(namedType.name, value)

    return value
}
