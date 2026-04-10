import type {
    FieldNode,
    FragmentDefinitionNode,
    GraphQLAbstractType,
    OperationDefinitionNode,
    GraphQLInputType,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLSchema,
} from 'graphql'
import type { SelectionModel } from './types'
import type { SelectionNode } from 'graphql'
import type { TypeRef } from './types'
import type { TypeSelectionNode } from './selection'

import {
    GraphQLNonNull,
    TypeInfo,
} from 'graphql'

import {
    getNamedType,
    isInterfaceType,
    isListType,
    isNonNullType,
    isObjectType,
    isUnionType,
    visit,
    visitWithTypeInfo,
} from 'graphql'

import { Kind } from 'graphql'
import {
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from './kinds'

import { GraphQLString } from 'graphql'

export const makeNonNullTypeRef = (typeRef: TypeRef): TypeRef => {
    return typeRef.kind === TYPE_REF_KIND.NON_NULL
        ? typeRef
        : {
            kind: TYPE_REF_KIND.NON_NULL,
            ofType: typeRef,
        }
}

export const shouldBuildTypeSelectionUnion = (
    abstractType: GraphQLNamedType | undefined,
    selections: SelectionNode[]
): abstractType is GraphQLAbstractType => {
    const hasTypeSpecificInlineFragments = selections.some(selection =>
        selection.kind === Kind.INLINE_FRAGMENT && !!selection.typeCondition
    )

    return !!abstractType
        && (isInterfaceType(abstractType) || isUnionType(abstractType))
        && hasTypeSpecificInlineFragments
}

export const getFragmentTypeNames = (
    fragmentDef: FragmentDefinitionNode,
    schema: GraphQLSchema
): { onType: string; onTypeNames?: string[] } => {
    const onType = fragmentDef.typeCondition.name.value
    const fragmentType = schema.getType(onType)

    return {
        onType,
        ...(fragmentType && (isInterfaceType(fragmentType) || isUnionType(fragmentType))
            ? { onTypeNames: schema.getPossibleTypes(fragmentType).map(type => type.name) }
            : {}),
    }
}

const getTypeNamesForParentType = (
    schema: GraphQLSchema,
    parentType: GraphQLOutputType
): string[] => {
    const namedType = getNamedType(parentType)

    if (isInterfaceType(namedType) || isUnionType(namedType)) {
        return schema
            .getPossibleTypes(namedType as GraphQLAbstractType)
            .map(type => type.name)
    }

    return [ namedType.name ]
}

const makeFieldTypeSelection = (
    selection: FieldNode,
    fields: WeakMap<FieldNode, GraphQLOutputType>,
    typeNames: WeakMap<FieldNode, string[]>,
    getTypesForSelections: (selections: SelectionNode[]) => WeakMap<SelectionNode, TypeSelectionNode>
): TypeSelectionNode | undefined => {
    const isTypeName = selection.name.value === '__typename' && typeNames.has(selection)
    const fieldType = fields.get(selection)
    if (fieldType) {
        return {
            kind: SELECTION_MODEL_KIND.FIELD,
            currentType: fieldType,
            ...(isTypeName && { typeNames: typeNames.get(selection) }),
            ...(selection.selectionSet?.selections
                && { selections: getTypesForSelections([ ...selection.selectionSet.selections ]) }
            ),
        }
    }

    return isTypeName
        ? {
            kind: SELECTION_MODEL_KIND.FIELD,
            currentType: new GraphQLNonNull(GraphQLString),
            typeNames: typeNames.get(selection),
        } : undefined
}

const makeTypeSelectionNode = (
    selection: SelectionNode,
    fields: WeakMap<FieldNode, GraphQLOutputType>,
    typeNames: WeakMap<FieldNode, string[]>,
    getTypesForSelections: (selections: SelectionNode[]) => WeakMap<SelectionNode, TypeSelectionNode>
): TypeSelectionNode | undefined => {
    switch (selection.kind) {
        case Kind.FIELD:
            return makeFieldTypeSelection(selection, fields, typeNames, getTypesForSelections)
        case Kind.FRAGMENT_SPREAD:
            return {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: selection.name.value,
            }
        case Kind.INLINE_FRAGMENT:
            return {
                kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                ...(selection.typeCondition?.name.value && { typeCondition: selection.typeCondition.name.value }),
                ...(selection.selectionSet.selections
                    && { selections: getTypesForSelections([ ...selection.selectionSet.selections ]) }
                ),
            }
    }
}

const makeTypeTreeForDef = (
    definition: FragmentDefinitionNode | OperationDefinitionNode,
    fields: WeakMap<FieldNode, GraphQLOutputType>,
    typeNames: WeakMap<FieldNode, string[]>
): WeakMap<SelectionNode, TypeSelectionNode> => {
    const getTypesForSelections = (selections: SelectionNode[]): WeakMap<SelectionNode, TypeSelectionNode> => {
        const nodes = new WeakMap<SelectionNode, TypeSelectionNode>()

        selections.forEach(selection => {
            if (nodes.has(selection)) return

            const typeSelection = makeTypeSelectionNode(selection, fields, typeNames, getTypesForSelections)
            if (typeSelection) nodes.set(selection, typeSelection)
        })

        return nodes
    }

    return getTypesForSelections([ ...definition.selectionSet.selections ])
}

export const getTypeForDefinition = (
    graphqlDef: FragmentDefinitionNode | OperationDefinitionNode,
    schema: GraphQLSchema
): WeakMap<SelectionNode, TypeSelectionNode> => {
    const typeInfo = new TypeInfo(schema)

    const fields = new WeakMap<FieldNode, GraphQLOutputType>()
    const typeNames = new WeakMap<FieldNode, string[]>()

    visit(
        graphqlDef,
        visitWithTypeInfo(typeInfo, {
            Field(node) {
                const fieldDef = typeInfo.getFieldDef()
                if (fieldDef && !fields.get(node)) fields.set(node, fieldDef.type)

                if (node.name.value === '__typename') {
                    const parentType = typeInfo.getParentType()
                    if (parentType) typeNames.set(node, getTypeNamesForParentType(schema, parentType))
                }
            },
        })
    )

    return makeTypeTreeForDef(graphqlDef, fields, typeNames)
}

export const makeTypeRefForInput = (type: GraphQLInputType): TypeRef => {
    if (isNonNullType(type)) {
        return {
            kind: TYPE_REF_KIND.NON_NULL,
            ofType: makeTypeRefForInput(type.ofType),
        }
    }

    if (isListType(type)) {
        return {
            kind: TYPE_REF_KIND.LIST,
            ofType: makeTypeRefForInput(type.ofType),
        }
    }

    return {
        kind: TYPE_REF_KIND.NAMED,
        name: getNamedType(type).name,
    }
}

export const makeTypeRefForField = (type: GraphQLOutputType): TypeRef => {
    if (isNonNullType(type)) {
        return {
            kind: TYPE_REF_KIND.NON_NULL,
            ofType: makeTypeRefForField(type.ofType),
        }
    }

    if (isListType(type)) {
        return {
            kind: TYPE_REF_KIND.LIST,
            ofType: makeTypeRefForField(type.ofType),
        }
    }

    return {
        kind: TYPE_REF_KIND.NAMED,
        name: getNamedType(type).name,
    }
}

export const filterSelectionsForConcreteType = (
    schema: GraphQLSchema,
    concreteType: GraphQLObjectType,
    selections: SelectionNode[]
): SelectionNode[] => selections.flatMap<SelectionNode>(selection => {
    if (selection.kind !== Kind.INLINE_FRAGMENT || !selection.typeCondition) return [ selection ]

    const conditionType = schema.getType(selection.typeCondition.name.value)
    if (!conditionType) return []

    if (isObjectType(conditionType)) {
        return conditionType.name === concreteType.name ? [ selection ] : []
    }

    return (isInterfaceType(conditionType) && concreteType.getInterfaces().some(type => type.name === conditionType.name)
        || isUnionType(conditionType) && schema.getPossibleTypes(conditionType).some(type => type.name === concreteType.name))
        ? [ selection ]
        : []
})

export const specializeTypeNameSelectionForConcreteType = (
    selections: SelectionModel[],
    typeName: string
): SelectionModel[] => selections.map(selection => {
    if (selection.kind !== SELECTION_MODEL_KIND.FIELD || selection.name !== '__typename') return selection

    return {
        ...selection,
        value: {
            kind: VALUE_MODEL_KIND.TYPENAME,
            typeNames: [ typeName ],
        },
    }
})
