import type { DefinitionNodeModel } from '../types/models'
import type {
    FieldNode,
    FragmentDefinitionNode,
    GraphQLAbstractType,
    OperationDefinitionNode,
    GraphQLOutputType,
    GraphQLSchema,
} from 'graphql'
import type { SelectionNode } from 'graphql'
import type { TypeRef } from '../types/models'
import type { TypeSelectionNode } from '../types/selection'

import { GraphQLNonNull } from 'graphql'
import { TypeInfo } from 'graphql'

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

import {
    DefinitionNodeKind,
    FieldValueKind,
} from '../enums/model-kinds'
import { Kind } from 'graphql'
import { TypeRefKind } from '../enums/model-kinds'

import { GraphQLString } from 'graphql'

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

const makeTypeTreeForDef = (
    definition: FragmentDefinitionNode | OperationDefinitionNode,
    fields: WeakMap<FieldNode, GraphQLOutputType>,
    typeNames: WeakMap<FieldNode, string[]>
): WeakMap<SelectionNode, TypeSelectionNode> => {
    const getTypesForSelections = (
        selections: SelectionNode[]
    ): WeakMap<SelectionNode, TypeSelectionNode> => {
        const nodes = new WeakMap<SelectionNode, TypeSelectionNode>()

        selections.forEach(selection => {
            if (nodes.has(selection)) return

            switch (selection.kind) {
                case Kind.FIELD: {
                    const isTypeName = selection.name.value === '__typename' && typeNames.has(selection)

                    if (fields.has(selection)) {
                        nodes.set(selection, {
                            kind: DefinitionNodeKind.FIELD,
                            currentType: fields.get(selection) as GraphQLOutputType,
                            ...(isTypeName && { typeNames: typeNames.get(selection) }),
                            ...(selection.selectionSet?.selections
                                && { selections: getTypesForSelections([ ...selection.selectionSet.selections ]) }
                            ),
                        })
                    } else if (isTypeName) {
                        nodes.set(selection, {
                            kind: DefinitionNodeKind.FIELD,
                            currentType: new GraphQLNonNull(GraphQLString),
                            typeNames: typeNames.get(selection),
                        })
                    }
                    break
                }
                case Kind.FRAGMENT_SPREAD:
                    nodes.set(selection, {
                        kind: DefinitionNodeKind.FRAGMENT_SPREAD,
                        name: selection.name.value,
                    })
                    break
                case Kind.INLINE_FRAGMENT:
                    nodes.set(selection, {
                        kind: DefinitionNodeKind.INLINE_FRAGMENT,
                        ...(selection.typeCondition?.name.value && { typeCondition: selection.typeCondition.name.value }),
                        ...(selection.selectionSet.selections && { selections: getTypesForSelections([ ...selection.selectionSet.selections ]) }),
                    })
                    break
            }
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

export const makeTypeRefForField = (name: string, type: GraphQLOutputType): TypeRef => {
    if (isNonNullType(type)) {
        return {
            kind: TypeRefKind.NON_NULL,
            ofType: makeTypeRefForField(name, type.ofType),
        }
    }

    if (isListType(type)) {
        return {
            kind: TypeRefKind.LIST,
            ofType: makeTypeRefForField(name, type.ofType),
        }
    }

    return {
        kind: TypeRefKind.NAMED,
        name: getNamedType(type).name,
    }
}

export const filterSelectionsForConcreteType = (
    schema: GraphQLSchema,
    concreteType: ReturnType<GraphQLSchema['getPossibleTypes']>[number],
    selections: SelectionNode[]
): SelectionNode[] => selections.flatMap<SelectionNode>(selection => {
    if (selection.kind !== Kind.INLINE_FRAGMENT || !selection.typeCondition) return [ selection ]

    const conditionType = schema.getType(selection.typeCondition.name.value)
    if (!conditionType) return []

    if (isObjectType(conditionType)) {
        return conditionType.name === concreteType.name ? [ selection ] : []
    }

    if (isInterfaceType(conditionType) && concreteType.getInterfaces().some(type => type.name === conditionType.name)
        || isUnionType(conditionType) && schema.getPossibleTypes(conditionType).some(type => type.name === concreteType.name)
    ) {
        return [ selection ]
    }

    return []
})

export const specializeTypeNameSelectionForConcreteType = (
    definitions: DefinitionNodeModel[],
    typeName: string
): DefinitionNodeModel[] => definitions.map(definition => {
    if (definition.kind !== DefinitionNodeKind.FIELD || definition.name !== '__typename') return definition

    return {
        ...definition,
        value: {
            kind: FieldValueKind.TYPENAME,
            typeNames: [ typeName ],
        },
    }
})
