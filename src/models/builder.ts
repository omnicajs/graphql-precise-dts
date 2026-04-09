import {
    ConfigDirectivePolicies,
    ConfigScalars,
} from '../config'
import type { EnumValueEntries } from './types'
import type { FieldNode } from 'graphql'
import type { FieldValue } from './types'
import type { FragmentDefinitionNode } from 'graphql'
import type {
    FragmentModel,
    FragmentRoot,
} from './types'
import type {
    GraphQLAbstractType,
    GraphQLInputType,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
} from 'graphql'
import type {
    InputField,
    InputValue,
} from './types'
import type { ModelContext } from './types'
import type { ModelRegistry } from './registry'
import type { OperationDefinitionNode } from 'graphql'
import type { OperationModel } from './types'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ResolvedSelectionDirectives } from '../directives'
import type { ScalarModelShape } from './types'
import type { Scalars } from '../scalars/types'
import type { SelectionModel } from './types'
import type { SelectionNode } from 'graphql'
import type {
    TypeFieldNode,
    TypeSelectionNode,
} from './selection'
import type { VariableDefinitionNode } from 'graphql'

import { TypeInfo } from 'graphql'

import { capitalize } from '../lib/strings'
import {
    filterSelectionsForConcreteType,
    getFragmentTypeNames,
} from './resolve'
import { getNamedType } from 'graphql'
import {
    getScalarPrimitiveShapeTs,
    getScalarTsShape,
    getScalarTsType,
} from '../scalars/builder'
import { getTypeForDefinition } from './resolve'
import { isConditionalSelectionState } from '../directives'
import {
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isNullableType,
    isObjectType,
} from 'graphql'
import { isScalarPrimitiveKey } from '../scalars/builder'
import { isScalarType } from 'graphql'
import { isUndefined } from '../lib/predicates'
import { isUnionType } from 'graphql'
import {
    makeNonNullTypeRef,
    makeTypeRefForField,
    makeTypeRefForInput,
} from './resolve'
import { resolveSelectionDirectives } from '../directives'
import { shouldBuildTypeSelectionUnion } from './resolve'
import { shouldForceNonNull } from '../directives'
import { specializeTypeNameSelectionForConcreteType } from './resolve'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

import { FragmentRootKind } from './kinds'
import {
    Kind,
    OperationTypeNode,
} from 'graphql'
import {
    SelectionModelKind,
    ValueModelKind,
} from './kinds'

import { SELECTION_STATES } from '../directives'

import { specifiedScalarTypes } from 'graphql'

type ResolvedSelectionContext = {
    fieldType: TypeSelectionNode;
    isConditional: boolean;
    resolvedDirectives: ResolvedSelectionDirectives;
}

type RegisteredNames = {
    fragments: string[];
    enums: string[];
}

const collectPrimitiveScalar = (
    type: GraphQLNamedType,
    usedScalars: Set<keyof Scalars>
) => {
    if (isScalarType(type) && isScalarPrimitiveKey(type.name)) {
        usedScalars.add(type.name as keyof Scalars)
    }
}

const collectUsedPrimitiveScalarsFromArguments = (
    argumentsList: ReadonlyArray<{ type: GraphQLInputType }>,
    usedScalars: Set<keyof Scalars>
) => {
    argumentsList.forEach(argument => {
        collectPrimitiveScalar(getNamedType(argument.type), usedScalars)
    })
}

const collectUsedPrimitiveScalarsFromObjectType = (
    type: GraphQLObjectType | GraphQLInterfaceType,
    usedScalars: Set<keyof Scalars>
) => Object.values(type.getFields()).forEach(field => {
    collectPrimitiveScalar(getNamedType(field.type), usedScalars)
    collectUsedPrimitiveScalarsFromArguments(field.args, usedScalars)
})

const collectUsedPrimitiveScalarsFromInputType = (
    type: GraphQLInputObjectType,
    usedScalars: Set<keyof Scalars>
) => Object.values(type.getFields()).forEach(field => {
    collectPrimitiveScalar(getNamedType(field.type), usedScalars)
})

const collectUsedPrimitiveScalars = (
    schema: Parameters<PluginFunction<PluginConfig>>[0]
): Set<keyof Scalars> => {
    const usedScalars = new Set<keyof Scalars>()

    Object.values(schema.getTypeMap()).forEach(type => {
        if (type.name.startsWith('__')) return

        if (isObjectType(type) || isInterfaceType(type)) {
            collectUsedPrimitiveScalarsFromObjectType(type, usedScalars)
        }

        if (isInputObjectType(type)) {
            collectUsedPrimitiveScalarsFromInputType(type, usedScalars)
        }
    })

    return usedScalars
}

const makeSelectionsForFields = (
    selections: readonly SelectionNode[] | undefined,
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    context: ModelContext
): SelectionModel[] => {
    if (!selections || !selectionTypes) return []

    return makeSelectionModels(
        [ ...selections ],
        selectionTypes,
        context
    )
}

const makeTypeNameFieldValue = (
    type: TypeFieldNode,
    field: FieldNode
): Extract<FieldValue, { kind: ValueModelKind.TYPENAME }> | undefined => {
    if (field.name.value !== '__typename' || !type.typeNames?.length) return

    return {
        kind: ValueModelKind.TYPENAME,
        typeNames: type.typeNames,
    }
}

const makeScalarFieldValue = (
    typeName: string,
    customScalars: ConfigScalars
): Extract<FieldValue, { kind: ValueModelKind.SCALAR }> => ({
    kind: ValueModelKind.SCALAR,
    typeTs: getScalarTsType(typeName, customScalars),
})

const makeEnumFieldValue = (
    typeName: string
): Extract<FieldValue, { kind: ValueModelKind.ENUM }> => ({
    kind: ValueModelKind.ENUM,
    name: typeName,
})

const makeInterfaceUnionFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode>,
    interfaceType: GraphQLInterfaceType,
    selections: readonly SelectionNode[],
    context: ModelContext
): Extract<FieldValue, { kind: ValueModelKind.UNION }> => ({
    kind: ValueModelKind.UNION,
    variants: context.schema.getPossibleTypes(interfaceType).map(possibleType => ({
        typeName: possibleType.name,
        fields: specializeTypeNameSelectionForConcreteType(
            makeSelectionModels(
                filterSelectionsForConcreteType(context.schema, possibleType, [ ...selections ]),
                typeSelections,
                context
            ),
            possibleType.name
        ),
    })),
})

const makeInterfaceObjectFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    interfaceType: GraphQLInterfaceType,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext
): Extract<FieldValue, { kind: ValueModelKind.OBJECT }> => ({
    kind: ValueModelKind.OBJECT,
    typeNames: context.schema.getPossibleTypes(interfaceType).map(possibleType => possibleType.name),
    fields: makeSelectionsForFields(selections, typeSelections, context),
})

const makeInterfaceFieldValue = (
    type: TypeFieldNode,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext
): FieldValue => {
    const interfaceType = getNamedType(type.currentType) as GraphQLInterfaceType

    if (selections && type.selections && shouldBuildTypeSelectionUnion(interfaceType, [ ...selections ])) {
        return makeInterfaceUnionFieldValue(type.selections, interfaceType, selections, context)
    }

    return makeInterfaceObjectFieldValue(type.selections, interfaceType, selections, context)
}

const makeObjectFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    objectType: GraphQLObjectType,
    context: ModelContext
): Extract<FieldValue, { kind: ValueModelKind.OBJECT }> => ({
    kind: ValueModelKind.OBJECT,
    typeNames: [ objectType.name ],
    fields: makeSelectionsForFields(selections, typeSelections, context),
})

const makeUnionFieldVariant = (
    selection: SelectionNode,
    typedSelection: TypeSelectionNode | undefined,
    context: ModelContext
): { typeName: string; fields: SelectionModel[] } | undefined => {
    if (selection.kind !== Kind.INLINE_FRAGMENT) return
    if (!typedSelection || typedSelection.kind !== SelectionModelKind.INLINE_FRAGMENT) return
    if (!typedSelection.selections) return

    const typeName = selection.typeCondition?.name.value ?? typedSelection.typeCondition
    if (!typeName) return

    return {
        typeName,
        fields: makeSelectionModels(
            [ ...selection.selectionSet.selections ],
            typedSelection.selections,
            context
        ),
    }
}

const makeUnionFieldValue = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext
): Extract<FieldValue, { kind: ValueModelKind.UNION }> => ({
    kind: ValueModelKind.UNION,
    variants: selections
        ? selections
            .map(selection => makeUnionFieldVariant(selection, typeSelections?.get(selection), context))
            .filter(selection => selection !== undefined)
        : [],
})

const makeFieldValue = (
    type: TypeFieldNode,
    field: FieldNode,
    context: ModelContext
): FieldValue => {
    const namedType = getNamedType(type.currentType)
    const typeNameValue = makeTypeNameFieldValue(type, field)
    const selections = field.selectionSet?.selections

    if (typeNameValue) return typeNameValue
    if (isScalarType(namedType)) return makeScalarFieldValue(namedType.name, context.customScalars)
    if (isEnumType(namedType)) return makeEnumFieldValue(namedType.name)
    if (isInterfaceType(namedType)) return makeInterfaceFieldValue(type, selections, context)
    if (isObjectType(namedType)) return makeObjectFieldValue(type.selections, selections, namedType, context)
    if (isUnionType(namedType)) return makeUnionFieldValue(type.selections, selections, context)

    return { kind: ValueModelKind.UNKNOWN, reason: 'Unknown type' }
}

const emitDirectiveWarnings = (warnings: string[]) => warnings.forEach(message => console.warn(message))

const getSelectionDefinitionKind = (selection: SelectionNode): SelectionModelKind => {
    return selection.kind === Kind.FIELD
        ? SelectionModelKind.FIELD
        : selection.kind === Kind.FRAGMENT_SPREAD
            ? SelectionModelKind.FRAGMENT_SPREAD
            : SelectionModelKind.INLINE_FRAGMENT
}

const resolveSelectionContext = (
    selection: SelectionNode,
    fieldType: TypeSelectionNode | undefined,
    directivePolicies: ConfigDirectivePolicies
): ResolvedSelectionContext | undefined => {
    const targetKind = getSelectionDefinitionKind(selection)
    const resolvedDirectives = resolveSelectionDirectives(
        selection.directives ? [ ...selection.directives ] : [],
        targetKind,
        directivePolicies
    )

    if (resolvedDirectives.state === SELECTION_STATES.EXCLUDED) return

    emitDirectiveWarnings(resolvedDirectives.warnings)

    if (!fieldType) return

    return {
        fieldType,
        isConditional: isConditionalSelectionState(resolvedDirectives.state),
        resolvedDirectives,
    }
}

const makeFieldSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FIELD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): Extract<SelectionModel, { kind: SelectionModelKind.FIELD }> | undefined => {
    if (selectionContext.fieldType.kind !== SelectionModelKind.FIELD) return

    const typeRef = makeTypeRefForField(selectionContext.fieldType.currentType)

    return {
        kind: SelectionModelKind.FIELD,
        name: selection.name.value,
        responseName: selection.alias?.value ?? selection.name.value,
        typeRef: shouldForceNonNull(
            selection.directives ? [ ...selection.directives ] : [],
            SelectionModelKind.FIELD,
            context.directivePolicies
        )
            ? makeNonNullTypeRef(typeRef)
            : typeRef,
        value: makeFieldValue(
            selectionContext.fieldType,
            selection,
            context
        ),
        conditional: selectionContext.isConditional,
        overrideTypeTs: selectionContext.resolvedDirectives.overrideTypeTs,
        directives: selectionContext.resolvedDirectives.directives,
    }
}

const makeFragmentSpreadSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FRAGMENT_SPREAD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): Extract<SelectionModel, { kind: SelectionModelKind.FRAGMENT_SPREAD }> | undefined => {
    if (selectionContext.fieldType.kind !== SelectionModelKind.FRAGMENT_SPREAD) return

    const spreadFragment = context.fragmentDefinitions.get(selection.name.value)
    if (!spreadFragment) return

    return {
        kind: SelectionModelKind.FRAGMENT_SPREAD,
        name: selection.name.value,
        ...getFragmentTypeNames(spreadFragment, context.schema),
        conditional: selectionContext.isConditional,
        directives: selectionContext.resolvedDirectives.directives,
    }
}

const makeInlineFragmentSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.INLINE_FRAGMENT }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): Extract<SelectionModel, { kind: SelectionModelKind.INLINE_FRAGMENT }> | undefined => {
    if (selectionContext.fieldType.kind === SelectionModelKind.INLINE_FRAGMENT && selectionContext.fieldType.selections) {
        return {
            kind: SelectionModelKind.INLINE_FRAGMENT,
            ...(selection.typeCondition?.name.value && { typeCondition: selection.typeCondition.name.value }),
            selections: makeSelectionModels(
                [ ...selection.selectionSet.selections ],
                selectionContext.fieldType.selections,
                context
            ),
            conditional: selectionContext.isConditional,
            directives: selectionContext.resolvedDirectives.directives,
        }
    }
}

const makeSelectionModel = (
    selection: SelectionNode,
    typeSelection: TypeSelectionNode | undefined,
    context: ModelContext
): SelectionModel | undefined => {
    const selectionContext = resolveSelectionContext(
        selection,
        typeSelection,
        context.directivePolicies
    )

    if (!selectionContext) return

    if (selection.kind === Kind.FIELD) {
        return makeFieldSelectionModel(selection, context, selectionContext)
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
        return makeFragmentSpreadSelectionModel(selection, context, selectionContext)
    }

    return makeInlineFragmentSelectionModel(selection, context, selectionContext)
}

const makeSelectionModels = (
    selections: SelectionNode[] = [],
    typesForSelectionsNode: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): SelectionModel[] => selections.reduce<SelectionModel[]>((selectionModels, selection) => {
    const typeSelection = typesForSelectionsNode.get(selection)
    const selectionModel = makeSelectionModel(selection, typeSelection, context)

    if (selectionModel) selectionModels.push(selectionModel)

    return selectionModels
}, [])

const makeFragmentUnionRoot = (
    fragmentType: GraphQLAbstractType,
    selections: SelectionNode[],
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): Extract<FragmentRoot, { kind: FragmentRootKind.UNION }> => ({
    kind: FragmentRootKind.UNION,
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
): Extract<FragmentRoot, { kind: FragmentRootKind.OBJECT }> => ({
    kind: FragmentRootKind.OBJECT,
    fields: makeSelectionModels(
        selections,
        selectionTypes,
        context
    ),
})

const makeFragmentModel = (
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

const makeInputValue = (
    type: GraphQLInputType,
    customScalars: ConfigScalars
): InputValue => {
    const namedType = getNamedType(type)

    if (isScalarType(namedType)) {
        return { kind: ValueModelKind.SCALAR, typeTs: getScalarTsType(namedType.name, customScalars) }
    }

    if (isEnumType(namedType)) {
        return { kind: ValueModelKind.ENUM, name: namedType.name }
    }

    if (isInputObjectType(namedType)) {
        return {
            kind: ValueModelKind.OBJECT,
            fields: Object.values(namedType.getFields()).map(field => ({
                name: field.name,
                typeRef: makeTypeRefForInput(field.type),
                optional: isNullableType(field.type) || !isUndefined(field.defaultValue),
                value: makeInputValue(field.type, customScalars),
            })),
        }
    }

    return { kind: ValueModelKind.UNKNOWN, reason: 'Unknown input type' }
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

const createModelRegistry = (): ModelRegistry => ({
    schema: {
        scalars: new Map<string, ScalarModelShape>(),
        enums: new Map<string, EnumValueEntries>(),
    },
    documents: {
        fragments: new Map<string, FragmentModel>(),
    },
})

const registerCustomScalars = (
    scalars: Map<string, ScalarModelShape>,
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    customScalars: ConfigScalars
) => Object.keys(customScalars).forEach(scalarName => {
    const scalarType = schema.getType(scalarName)

    if (isScalarType(scalarType) && !scalars.has(scalarName)) {
        scalars.set(scalarName, getScalarTsShape(scalarName, customScalars))
    }
})

const registerPrimitiveScalars = (
    scalars: Map<string, ScalarModelShape>,
    usedPrimitiveScalars: Set<keyof Scalars>
) => specifiedScalarTypes.forEach(({ name }) => {
    if (usedPrimitiveScalars.has(name as keyof Scalars) && !scalars.has(name)) {
        scalars.set(name, getScalarPrimitiveShapeTs(name as keyof Scalars))
    }
})

const registerEnums = (
    enums: Map<string, EnumValueEntries>,
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    importEnumsName: string[]
) => importEnumsName.forEach(enumName => {
    const enumType = schema.getType(enumName)

    if (isEnumType(enumType) && !enums.has(enumName)) {
        enums.set(enumName, enumType.getValues().map(v => ({
            name: v.name,
            value: v.value,
        })))
    }
})

const registerFragments = (
    fragments: Map<string, FragmentModel>,
    importFragmentsName: string[],
    context: ModelContext
) => {
    for (const [ key, def ] of context.fragmentDefinitions.entries()) {
        if (importFragmentsName.includes(key) && !fragments.has(key)) {
            fragments.set(key, makeFragmentModel(def, context))
        }
    }
}

export const buildModelRegistry = (
    registeredNames: RegisteredNames,
    context: ModelContext
): ModelRegistry => {
    const registry = createModelRegistry()
    const usedPrimitiveScalars = collectUsedPrimitiveScalars(context.schema)

    registerCustomScalars(registry.schema.scalars, context.schema, context.customScalars)
    registerPrimitiveScalars(registry.schema.scalars, usedPrimitiveScalars)
    registerEnums(registry.schema.enums, context.schema, registeredNames.enums)
    registerFragments(registry.documents.fragments, registeredNames.fragments, context)

    return registry
}
