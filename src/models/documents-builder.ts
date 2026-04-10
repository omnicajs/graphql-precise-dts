import type { ConfigScalars } from '../config'
import type { FragmentDefinitionNode } from 'graphql'
import type {
    FragmentModel,
    FragmentRoot,
} from './types'
import type {
    GraphQLAbstractType,
    GraphQLInputType,
} from 'graphql'
import type {
    InputField,
    ModelContext,
} from './types'
import type { OperationDefinitionNode } from 'graphql'
import type { OperationModel } from './types'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { SelectionNode } from 'graphql'
import type { TypeSelectionNode } from './selection'
import type { VariableDefinitionNode } from 'graphql'

import { TypeInfo } from 'graphql'

import { capitalize } from '../lib/strings'
import {
    filterSelectionsForConcreteType,
    getFragmentTypeNames,
} from './resolve'
import { getTypeForDefinition } from './resolve'
import { isNullableType } from 'graphql'
import { isUndefined } from '../lib/predicates'
import { makeInputValue } from './value-models-builder'
import { makeSelectionModels } from './selections-builder'
import {
    makeTypeRefForInput,
    shouldBuildTypeSelectionUnion,
    specializeTypeNameSelectionForConcreteType,
} from './resolve'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

import { FRAGMENT_ROOT_KIND } from './kinds'
import { OperationTypeNode } from 'graphql'

const makeFragmentUnionRoot = (
    fragmentType: GraphQLAbstractType,
    selections: SelectionNode[],
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): Extract<FragmentRoot, { kind: typeof FRAGMENT_ROOT_KIND.UNION }> => ({
    kind: FRAGMENT_ROOT_KIND.UNION,
    variants: context.schema.getPossibleTypes(fragmentType).map(type => ({
        typeName: type.name,
        fields: specializeTypeNameSelectionForConcreteType(
            makeSelectionModels(
                filterSelectionsForConcreteType(context.schema, type, selections),
                selectionTypes,
                context
            ),
            type.name
        ),
    })),
})

const makeFragmentObjectRoot = (
    selections: SelectionNode[],
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): Extract<FragmentRoot, { kind: typeof FRAGMENT_ROOT_KIND.OBJECT }> => ({
    kind: FRAGMENT_ROOT_KIND.OBJECT,
    fields: makeSelectionModels(
        selections,
        selectionTypes,
        context
    ),
})

export const makeFragmentModel = (
    graphqlDef: FragmentDefinitionNode,
    context: ModelContext
): FragmentModel => {
    const fragmentType = context.schema.getType(graphqlDef.typeCondition.name.value)
    const selections = [ ...graphqlDef.selectionSet.selections ]
    const selectionTypes = getTypeForDefinition(graphqlDef, context.schema)

    return {
        ...getFragmentTypeNames(graphqlDef, context.schema),
        root: shouldBuildTypeSelectionUnion(fragmentType, selections)
            ? makeFragmentUnionRoot(
                fragmentType,
                selections,
                selectionTypes,
                context
            )
            : makeFragmentObjectRoot(
                selections,
                selectionTypes,
                context
            ),
    }
}

const makeOperationVariable = (
    variableName: string,
    type: GraphQLInputType,
    customScalars: ConfigScalars,
    hasDefaultValue = false
): InputField => ({
    name: variableName,
    typeRef: makeTypeRefForInput(type),
    optional: isNullableType(type) || hasDefaultValue,
    value: makeInputValue(type, customScalars),
})

const getRootTypeForOperation = (
    operation: OperationTypeNode,
    schema: Parameters<PluginFunction<PluginConfig>>[0]
) => {
    switch (operation) {
        case OperationTypeNode.QUERY:
            return schema.getQueryType()
        case OperationTypeNode.MUTATION:
            return schema.getMutationType()
        case OperationTypeNode.SUBSCRIPTION:
            return schema.getSubscriptionType()
    }
}

export const makeOperationModel = (
    graphqlDef: OperationDefinitionNode,
    context: ModelContext
): OperationModel | undefined => {
    const rootType = getRootTypeForOperation(graphqlDef.operation, context.schema)
    if (!rootType) return

    const selectionTypes = getTypeForDefinition(graphqlDef, context.schema)
    const variables = new WeakMap<VariableDefinitionNode, GraphQLInputType>()
    const typeInfo = new TypeInfo(context.schema)

    visit(
        graphqlDef,
        visitWithTypeInfo(typeInfo, {
            VariableDefinition(node) {
                const inputType = typeInfo.getInputType()
                if (inputType && !variables.has(node)) variables.set(node, inputType)
            },
        })
    )

    return {
        operationType: graphqlDef.operation,
        onType: capitalize(rootType.name),
        variables: (graphqlDef.variableDefinitions ?? [])
            .flatMap(variableDefinition => {
                const variableType = variables.get(variableDefinition)

                return variableType
                    ? [
                        makeOperationVariable(
                            variableDefinition.variable.name.value,
                            variableType,
                            context.customScalars,
                            !isUndefined(variableDefinition.defaultValue)
                        ),
                    ] : []
            }),
        result: makeSelectionModels(
            [ ...graphqlDef.selectionSet.selections ],
            selectionTypes,
            context
        ),
    }
}
