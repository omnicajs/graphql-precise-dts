import type { ModelContext } from './types/context'
import type { TypeSelectionNode } from './selection'
import type { VariableField } from './types/value'

import type {
    FragmentModel,
    FragmentRoot,
    OperationModel,
} from './types/document'

import type {
    FragmentDefinitionNode,
    GraphQLAbstractType,
    GraphQLInputType,
    OperationDefinitionNode,
    SelectionNode,
    VariableDefinitionNode,
} from 'graphql'

import { TypeInfo } from 'graphql'

import { getRootTypeForOperation } from '../lib/operations'
import { isUndefined } from '../lib/predicates'
import { capitalize } from '../lib/strings'
import { makeSelectionModels } from './selections-builder'
import { makeVariableValue } from './value-builder'

import {
    filterSelectionsForConcreteType,
    getFragmentTypeNames,
    getTypeForDefinition,
    makeTypeRefForVariable,
    shouldBuildTypeSelectionUnion,
    specializeTypenameSelections,
} from './resolve'

import {
    isNullableType,
    visit,
    visitWithTypeInfo,
} from 'graphql'

import { FRAGMENT_ROOT_KIND } from '../kinds'

const makeFragmentUnionRoot = (
    fragmentType: GraphQLAbstractType,
    selections: SelectionNode[],
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext,
    diagnosticOwner: string
): Extract<FragmentRoot, { kind: typeof FRAGMENT_ROOT_KIND.UNION }> => ({
    kind: FRAGMENT_ROOT_KIND.UNION,
    variants: context.schema.getPossibleTypes(fragmentType).map(type => ({
        typeName: type.name,
        fields: specializeTypenameSelections(
            makeSelectionModels(
                filterSelectionsForConcreteType(context.schema, type, selections),
                selectionTypes,
                context,
                diagnosticOwner
            ),
            type.name
        ),
    })),
})

const makeFragmentObjectRoot = (
    selections: SelectionNode[],
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext,
    diagnosticOwner: string
): Extract<FragmentRoot, { kind: typeof FRAGMENT_ROOT_KIND.OBJECT }> => ({
    kind: FRAGMENT_ROOT_KIND.OBJECT,
    fields: makeSelectionModels(
        selections,
        selectionTypes,
        context,
        diagnosticOwner
    ),
})

export const makeFragmentModel = (
    graphqlDef: FragmentDefinitionNode,
    context: ModelContext
): FragmentModel => {
    const fragmentType = context.schema.getType(graphqlDef.typeCondition.name.value)
    const selections = [ ...graphqlDef.selectionSet.selections ]
    const selectionTypes = getTypeForDefinition(graphqlDef, context.schema)
    const diagnosticOwner = `fragment "${graphqlDef.name.value}"`

    return {
        ...getFragmentTypeNames(graphqlDef, context.schema),
        root: shouldBuildTypeSelectionUnion(fragmentType, selections, context.structuralDirectivePolicies)
            ? makeFragmentUnionRoot(
                fragmentType,
                selections,
                selectionTypes,
                context,
                diagnosticOwner
            )
            : makeFragmentObjectRoot(
                selections,
                selectionTypes,
                context,
                diagnosticOwner
            ),
    }
}

const makeOperationVariable = (
    variableName: string,
    type: GraphQLInputType,
    hasDefaultValue = false
): VariableField => ({
    name: variableName,
    typeRef: makeTypeRefForVariable(type),
    optional: isNullableType(type) || hasDefaultValue,
    value: makeVariableValue(type),
})

export const makeOperationModel = (
    graphqlDef: OperationDefinitionNode,
    context: ModelContext
): OperationModel | undefined => {
    const rootType = getRootTypeForOperation(graphqlDef.operation, context.schema)
    if (!rootType) return
    const diagnosticOwner = `${graphqlDef.operation} "${graphqlDef.name?.value ?? 'unknow'}"`

    const selectionTypes = getTypeForDefinition(graphqlDef, context.schema)
    const variables = new WeakMap<VariableDefinitionNode, GraphQLInputType>()
    const typeInfo = new TypeInfo(context.schema)

    visit(
        graphqlDef,
        visitWithTypeInfo(typeInfo, {
            VariableDefinition(node) {
                const inputType = typeInfo.getInputType()
                /* v8 ignore next -- @preserve TypeInfo resolves variable input types for valid GraphQL operation definitions. */
                if (!inputType) return

                variables.set(node, inputType)
            },
        })
    )

    let variableDefinitions = graphqlDef.variableDefinitions
    /* v8 ignore next -- @preserve graphql-js parse returns an empty array when operations have no variable definitions. */
    if (!variableDefinitions) variableDefinitions = []

    return {
        operationType: graphqlDef.operation,
        onType: capitalize(rootType.name),
        variables: variableDefinitions
            .flatMap(variableDefinition => {
                const variableType = variables.get(variableDefinition)
                /* v8 ignore next -- @preserve TypeInfo resolves variable input types for valid GraphQL operation definitions. */
                if (!variableType) return []

                return [
                    makeOperationVariable(
                        variableDefinition.variable.name.value,
                        variableType,
                        !isUndefined(variableDefinition.defaultValue)
                    ),
                ]
            }),
        result: makeSelectionModels(
            [ ...graphqlDef.selectionSet.selections ],
            selectionTypes,
            context,
            diagnosticOwner
        ),
    }
}
