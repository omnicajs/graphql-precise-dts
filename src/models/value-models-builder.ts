import type { ConfigScalars } from '../config'
import type { FieldNode } from 'graphql'
import type { FieldValue } from './types'
import type {
    GraphQLInputType,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
} from 'graphql'
import type {
    ModelContext,
    SelectionModel,
} from './types'
import type { SelectionNode } from 'graphql'
import type {
    TypeFieldNode,
    TypeSelectionNode,
} from './selection'
import type { VariableValue } from './types'

import { GraphQLObjectType } from 'graphql'

import { getNamedType } from 'graphql'
import { getScalarTsType } from '../scalars/builder'
import {
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isNullableType,
    isObjectType,
    isScalarType,
} from 'graphql'
import { isUndefined } from '../lib/predicates'
import { isUnionType } from 'graphql'
import { filterSelectionsForConcreteType } from './resolve'
import {
    makeSelectionModels,
    makeSelectionsForFields,
} from './selections-builder'
import {
    makeTypeRefForVariable,
    shouldBuildTypeSelectionUnion,
    specializeTypeNameSelectionForConcreteType,
} from './resolve'

import { Kind } from 'graphql'
import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from './kinds'

const makeScalarFieldValue = (
    typeName: string,
    customScalars: ConfigScalars
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    typeTs: getScalarTsType(typeName, customScalars),
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
        fields: specializeTypeNameSelectionForConcreteType(
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
        context.directivePolicies
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

const makeUnionFieldVariant = (
    selection: SelectionNode,
    typedSelection: TypeSelectionNode | undefined,
    context: ModelContext,
    diagnosticOwner: string
): { typeName: string; fields: SelectionModel[] } | undefined => {
    if (selection.kind !== Kind.INLINE_FRAGMENT) return
    if (!typedSelection || typedSelection.kind !== SELECTION_MODEL_KIND.INLINE_FRAGMENT) return
    if (!typedSelection.selections) return

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

const makeUnionFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext,
    diagnosticOwner: string
): Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.UNION }> => ({
    kind: VALUE_MODEL_KIND.UNION,
    variants: selections
        ? selections
            .map(selection => makeUnionFieldVariant(selection, typeSelections?.get(selection), context, diagnosticOwner))
            .filter(selection => selection !== undefined)
        : [],
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
    if (isScalarType(namedType)) return makeScalarFieldValue(namedType.name, context.customScalars)
    if (isEnumType(namedType)) return makeEnumFieldValue(namedType.name)
    if (isInterfaceType(namedType)) return makeInterfaceFieldValue(type, selections, context, diagnosticOwner)
    if (isObjectType(namedType)) {
        return makeObjectFieldValue(type.selections, selections, namedType, context, diagnosticOwner)
    }
    if (isUnionType(namedType)) return makeUnionFieldValue(type.selections, selections, context, diagnosticOwner)

    return { kind: VALUE_MODEL_KIND.UNKNOWN, reason: 'Unknown type' }
}

export const makeVariableValue = (
    type: GraphQLInputType,
    customScalars: ConfigScalars
): VariableValue => buildVariableValue(type, customScalars, {
    inProgress: new Set(),
    cache: new Map(),
})

const buildVariableValue = (
    type: GraphQLInputType,
    customScalars: ConfigScalars,
    state: {
        inProgress: Set<string>;
        cache: Map<string, Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>;
    }
): VariableValue => {
    const namedType = getNamedType(type)

    if (isScalarType(namedType)) {
        return {
            kind: VALUE_MODEL_KIND.SCALAR,
            typeTs: getScalarTsType(namedType.name, customScalars, 'input'),
        }
    }

    if (isEnumType(namedType)) {
        return { kind: VALUE_MODEL_KIND.ENUM, name: namedType.name }
    }

    if (isInputObjectType(namedType)) {
        return buildVariableObjectValue(namedType, customScalars, state)
    }

    return { kind: VALUE_MODEL_KIND.UNKNOWN, reason: 'Unknown variable type' }
}

const buildVariableObjectValue = (
    namedType: GraphQLInputObjectType,
    customScalars: ConfigScalars,
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
            value: buildVariableValue(field.type, customScalars, state),
        })),
    }

    state.inProgress.delete(namedType.name)
    state.cache.set(namedType.name, value)

    return value
}
