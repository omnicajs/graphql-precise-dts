import type {
    ConfigDirectivePolicies,
    ConfigScalar,
} from '../config'
import type { DefinitionNodeModel } from '../types/models'
import type { DefRegistry } from '../types/registry'
import type { EnumDefinitionModel } from '../types/models'
import type { FieldNode } from 'graphql'
import type { FieldValueModel } from '../types/models'
import type { FragmentDefinitionNode } from 'graphql'
import type { FragmentModel, FragmentRootModel } from '../types/models'
import type {
    GraphQLAbstractType,
    GraphQLInputType,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
} from 'graphql'
import type {
    InputFieldModel,
    InputValueModel,
} from '../types/models'
import type { ModelContext } from '../types/models'
import type { OperationDefinitionNode } from 'graphql'
import type { OperationModel } from '../types/models'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ResolvedSelectionDirectives } from './directives'
import type { ScalarModel } from '../types/models'
import type { Scalars } from '../types/scalars'
import type { SelectionNode } from 'graphql'
import type { TypeFieldNode } from '../types/selection'
import type { TypeSelectionNode } from '../types/selection'
import type { VariableDefinitionNode } from 'graphql'

import { TypeInfo } from 'graphql'

import { capitalize } from '../lib/string'
import {
    filterSelectionsForConcreteType,
    getFragmentTypeNames,
} from './type-resolution'
import { getNamedType } from 'graphql'
import {
    getScalarPrimitiveShapeTs,
    getScalarTsShape,
    getScalarTsType,
} from './scalar-type-mapping'
import { getTypeForDefinition } from './type-resolution'
import { isConditionalSelectionState } from './directives'
import {
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isNullableType,
    isObjectType,
} from 'graphql'
import { isScalarPrimitiveKey } from './scalar-type-mapping'
import { isScalarType } from 'graphql'
import { isUndefined } from '../lib/predicates'
import { isUnionType } from 'graphql'
import {
    makeNonNullTypeRef,
    makeTypeRefForField,
    makeTypeRefForInput,
} from './type-resolution'
import { resolveSelectionDirectives } from './directives'
import { shouldBuildTypeSelectionUnion } from './type-resolution'
import { shouldForceNonNull } from './directives'
import { specializeTypeNameSelectionForConcreteType } from './type-resolution'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

import {
    DefinitionNodeKind,
    FieldValueKind,
    FragmentRootKind,
} from '../enums/model-kinds'
import { Kind } from 'graphql'
import { OperationTypeNode } from 'graphql'

import { selectionStates } from './directives'
import { specifiedScalarTypes } from 'graphql'

type ResolvedSelectionContext = {
    fieldType: TypeSelectionNode;
    isConditional: boolean;
    resolvedDirectives: ResolvedSelectionDirectives;
}

type RegisteredDefinitions = {
    fragment: string[];
    enums: string[];
}

type DefinitionRegistryState = {
    scalars: Map<string, ScalarModel>;
    enums: Map<string, EnumDefinitionModel>;
    fragments: Map<string, FragmentModel>;
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

const makeDefinitionsForFieldSelections = (
    selections: readonly SelectionNode[] | undefined,
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    context: ModelContext
): DefinitionNodeModel[] => {
    if (!selections || !selectionTypes) return []

    return makeDefinitionsModel(
        [ ...selections ],
        selectionTypes,
        context
    )
}

const makeTypeNameFieldValueModel = (
    type: TypeFieldNode,
    field: FieldNode
): Extract<FieldValueModel, { kind: FieldValueKind.TYPENAME }> | undefined => {
    if (field.name.value !== '__typename' || !type.typeNames?.length) return

    return {
        kind: FieldValueKind.TYPENAME,
        typeNames: type.typeNames,
    }
}

const makeScalarFieldValueModel = (
    typeName: string,
    customScalars: ConfigScalar
): Extract<FieldValueModel, { kind: FieldValueKind.SCALAR }> => ({
    kind: FieldValueKind.SCALAR,
    typeTs: getScalarTsType(typeName, customScalars),
})

const makeEnumFieldValueModel = (
    typeName: string
): Extract<FieldValueModel, { kind: FieldValueKind.ENUM }> => ({
    kind: FieldValueKind.ENUM,
    name: typeName,
})

const makeInterfaceUnionFieldValueModel = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode>,
    interfaceType: GraphQLInterfaceType,
    selections: readonly SelectionNode[],
    context: ModelContext
): Extract<FieldValueModel, { kind: FieldValueKind.UNION }> => ({
    kind: FieldValueKind.UNION,
    variants: context.schema.getPossibleTypes(interfaceType).map(possibleType => ({
        typeName: possibleType.name,
        fields: specializeTypeNameSelectionForConcreteType(
            makeDefinitionsModel(
                filterSelectionsForConcreteType(context.schema, possibleType, [ ...selections ]),
                typeSelections,
                context
            ),
            possibleType.name
        ),
    })),
})

const makeInterfaceObjectFieldValueModel = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    interfaceType: GraphQLInterfaceType,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext
): Extract<FieldValueModel, { kind: FieldValueKind.OBJECT }> => ({
    kind: FieldValueKind.OBJECT,
    typeNames: context.schema.getPossibleTypes(interfaceType).map(possibleType => possibleType.name),
    fields: makeDefinitionsForFieldSelections(selections, typeSelections, context),
})

const makeInterfaceFieldValueModel = (
    type: TypeFieldNode,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext
): FieldValueModel => {
    const interfaceType = getNamedType(type.currentType) as GraphQLInterfaceType

    if (selections && type.selections && shouldBuildTypeSelectionUnion(interfaceType, [ ...selections ])) {
        return makeInterfaceUnionFieldValueModel(type.selections, interfaceType, selections, context)
    }

    return makeInterfaceObjectFieldValueModel(type.selections, interfaceType, selections, context)
}

const makeObjectFieldValueModel = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    objectType: GraphQLObjectType,
    context: ModelContext
): Extract<FieldValueModel, { kind: FieldValueKind.OBJECT }> => ({
    kind: FieldValueKind.OBJECT,
    typeNames: [ objectType.name ],
    fields: makeDefinitionsForFieldSelections(selections, typeSelections, context),
})

const makeUnionFieldVariant = (
    selection: SelectionNode,
    typedSelection: TypeSelectionNode | undefined,
    context: ModelContext
): { typeName: string; fields: DefinitionNodeModel[] } | undefined => {
    if (selection.kind !== Kind.INLINE_FRAGMENT) return
    if (!typedSelection || typedSelection.kind !== DefinitionNodeKind.INLINE_FRAGMENT) return
    if (!typedSelection.selections) return

    const typeName = selection.typeCondition?.name.value ?? typedSelection.typeCondition
    if (!typeName) return

    return {
        typeName,
        fields: makeDefinitionsModel(
            [ ...selection.selectionSet.selections ],
            typedSelection.selections,
            context
        ),
    }
}

const makeUnionFieldValueModel = (
    typeSelections: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    selections: readonly SelectionNode[] | undefined,
    context: ModelContext
): Extract<FieldValueModel, { kind: FieldValueKind.UNION }> => ({
    kind: FieldValueKind.UNION,
    variants: selections
        ? selections
            .map(selection => makeUnionFieldVariant(selection, typeSelections?.get(selection), context))
            .filter(selection => selection !== undefined)
        : [],
})

const makeFieldModel = (
    type: TypeFieldNode,
    field: FieldNode,
    context: ModelContext
): FieldValueModel => {
    const namedType = getNamedType(type.currentType)
    const typeNameValue = makeTypeNameFieldValueModel(type, field)
    const selections = field.selectionSet?.selections

    if (typeNameValue) return typeNameValue
    if (isScalarType(namedType)) return makeScalarFieldValueModel(namedType.name, context.customScalars)
    if (isEnumType(namedType)) return makeEnumFieldValueModel(namedType.name)
    if (isInterfaceType(namedType)) return makeInterfaceFieldValueModel(type, selections, context)
    if (isObjectType(namedType)) return makeObjectFieldValueModel(type.selections, selections, namedType, context)
    if (isUnionType(namedType)) return makeUnionFieldValueModel(type.selections, selections, context)

    return { kind: FieldValueKind.UNKNOWN, reason: 'Unknown type' }
}

const emitDirectiveWarnings = (warnings: string[]) => warnings.forEach(message => console.warn(message))

const getSelectionDefinitionKind = (selection: SelectionNode): DefinitionNodeKind => {
    return selection.kind === Kind.FIELD
        ? DefinitionNodeKind.FIELD
        : selection.kind === Kind.FRAGMENT_SPREAD
            ? DefinitionNodeKind.FRAGMENT_SPREAD
            : DefinitionNodeKind.INLINE_FRAGMENT
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

    if (resolvedDirectives.state === selectionStates.EXCLUDED) return

    emitDirectiveWarnings(resolvedDirectives.warnings)

    if (!fieldType) return

    return {
        fieldType,
        isConditional: isConditionalSelectionState(resolvedDirectives.state),
        resolvedDirectives,
    }
}

const makeFieldDefinitionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FIELD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): DefinitionNodeModel | undefined => {
    if (selectionContext.fieldType.kind !== DefinitionNodeKind.FIELD) return

    const typeRef = makeTypeRefForField(selectionContext.fieldType.currentType)

    return {
        kind: DefinitionNodeKind.FIELD,
        name: selection.name.value,
        responseName: selection.alias?.value ?? selection.name.value,
        typeRef: shouldForceNonNull(
            selection.directives ? [ ...selection.directives ] : [],
            DefinitionNodeKind.FIELD,
            context.directivePolicies
        )
            ? makeNonNullTypeRef(typeRef)
            : typeRef,
        value: makeFieldModel(
            selectionContext.fieldType,
            selection,
            context
        ),
        conditional: selectionContext.isConditional,
        overrideTypeTs: selectionContext.resolvedDirectives.overrideTypeTs,
        directives: selectionContext.resolvedDirectives.directives,
    }
}

const makeFragmentSpreadDefinitionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FRAGMENT_SPREAD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): DefinitionNodeModel | undefined => {
    if (selectionContext.fieldType.kind !== DefinitionNodeKind.FRAGMENT_SPREAD) return

    const spreadFragment = context.fragmentsDefs.get(selection.name.value)
    if (!spreadFragment) return

    return {
        kind: DefinitionNodeKind.FRAGMENT_SPREAD,
        name: selection.name.value,
        ...getFragmentTypeNames(spreadFragment, context.schema),
        conditional: selectionContext.isConditional,
        directives: selectionContext.resolvedDirectives.directives,
    }
}

const makeInlineFragmentDefinitionModel = (
    selection: Extract<SelectionNode, { kind: Kind.INLINE_FRAGMENT }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): DefinitionNodeModel | undefined => {
    if (selectionContext.fieldType.kind === DefinitionNodeKind.INLINE_FRAGMENT && selectionContext.fieldType.selections) {
        return {
            kind: DefinitionNodeKind.INLINE_FRAGMENT,
            ...(selection.typeCondition?.name.value && { typeCondition: selection.typeCondition.name.value }),
            selections: makeDefinitionsModel(
                [ ...selection.selectionSet.selections ],
                selectionContext.fieldType.selections,
                context
            ),
            conditional: selectionContext.isConditional,
            directives: selectionContext.resolvedDirectives.directives,
        }
    }
}

const makeSelectionDefinitionModel = (
    selection: SelectionNode,
    typeSelection: TypeSelectionNode | undefined,
    context: ModelContext
): DefinitionNodeModel | undefined => {
    const selectionContext = resolveSelectionContext(
        selection,
        typeSelection,
        context.directivePolicies
    )

    if (!selectionContext) return

    if (selection.kind === Kind.FIELD) {
        return makeFieldDefinitionModel(selection, context, selectionContext)
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
        return makeFragmentSpreadDefinitionModel(selection, context, selectionContext)
    }

    return makeInlineFragmentDefinitionModel(selection, context, selectionContext)
}

const makeDefinitionsModel = (
    selections: SelectionNode[] = [],
    typesForSelectionsNode: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): DefinitionNodeModel[] => selections.reduce<DefinitionNodeModel[]>((definitions, selection) => {
    const typeSelection = typesForSelectionsNode.get(selection)
    const definition = makeSelectionDefinitionModel(selection, typeSelection, context)

    if (definition) definitions.push(definition)

    return definitions
}, [])

const makeFragmentUnionRoot = (
    fragmentType: GraphQLAbstractType,
    selections: SelectionNode[],
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): Extract<FragmentRootModel, { kind: FragmentRootKind.UNION }> => ({
    kind: FragmentRootKind.UNION,
    variants: context.schema.getPossibleTypes(fragmentType).map(type => ({
        typeName: type.name,
        fields: specializeTypeNameSelectionForConcreteType(
            makeDefinitionsModel(
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
): Extract<FragmentRootModel, { kind: FragmentRootKind.OBJECT }> => ({
    kind: FragmentRootKind.OBJECT,
    fields: makeDefinitionsModel(
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

const makeInputValueModel = (
    type: GraphQLInputType,
    customScalars: ConfigScalar
): InputValueModel => {
    const namedType = getNamedType(type)

    if (isScalarType(namedType)) {
        return { kind: FieldValueKind.SCALAR, typeTs: getScalarTsType(namedType.name, customScalars) }
    }

    if (isEnumType(namedType)) {
        return { kind: FieldValueKind.ENUM, name: namedType.name }
    }

    if (isInputObjectType(namedType)) {
        return {
            kind: FieldValueKind.OBJECT,
            fields: Object.values(namedType.getFields()).map(field => ({
                name: field.name,
                typeRef: makeTypeRefForInput(field.type),
                optional: isNullableType(field.type) || !isUndefined(field.defaultValue),
                value: makeInputValueModel(field.type, customScalars),
            })),
        }
    }

    return { kind: FieldValueKind.UNKNOWN, reason: 'Unknown input type' }
}

const makeOperationVariableModel = (
    variableName: string,
    type: GraphQLInputType,
    customScalars: ConfigScalar,
    hasDefaultValue = false
): InputFieldModel => ({
    name: variableName,
    typeRef: makeTypeRefForInput(type),
    optional: isNullableType(type) || hasDefaultValue,
    value: makeInputValueModel(type, customScalars),
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
                        makeOperationVariableModel(
                            variableDefinition.variable.name.value,
                            variableType,
                            context.customScalars,
                            !isUndefined(variableDefinition.defaultValue)
                        ),
                    ] : []
            }),
        result: makeDefinitionsModel(
            [ ...graphqlDef.selectionSet.selections ],
            selectionTypes,
            context
        ),
    }
}

const createDefinitionRegistryState = (): DefinitionRegistryState => ({
    scalars: new Map<string, ScalarModel>(),
    enums: new Map<string, EnumDefinitionModel>(),
    fragments: new Map<string, FragmentModel>(),
})

const registerCustomScalars = (
    registry: DefinitionRegistryState,
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    customScalars: ConfigScalar
) => Object.keys(customScalars).forEach(scalarName => {
    const scalarType = schema.getType(scalarName)

    if (isScalarType(scalarType) && !registry.scalars.has(scalarName)) {
        registry.scalars.set(scalarName, getScalarTsShape(scalarName, customScalars))
    }
})

const registerPrimitiveScalars = (
    registry: DefinitionRegistryState,
    usedPrimitiveScalars: Set<keyof Scalars>
) => specifiedScalarTypes.forEach(({ name }) => {
    if (usedPrimitiveScalars.has(name as keyof Scalars) && !registry.scalars.has(name)) {
        registry.scalars.set(name, getScalarPrimitiveShapeTs(name as keyof Scalars))
    }
})

const registerEnums = (
    registry: DefinitionRegistryState,
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    importEnumsName: string[]
) => importEnumsName.forEach(enumName => {
    const enumType = schema.getType(enumName)

    if (isEnumType(enumType) && !registry.enums.has(enumName)) {
        registry.enums.set(enumName, enumType.getValues().map(v => ({
            name: v.name,
            value: v.value,
        })))
    }
})

const registerFragments = (
    registry: DefinitionRegistryState,
    importFragmentsName: string[],
    context: ModelContext
) => {
    for (const [ key, def ] of context.fragmentsDefs.entries()) {
        if (importFragmentsName.includes(key) && !registry.fragments.has(key)) {
            registry.fragments.set(key, makeFragmentModel(def, context))
        }
    }
}

export const buildDefinitionRegistry = (
    registered: RegisteredDefinitions,
    context: ModelContext
): DefRegistry => {
    const registry = createDefinitionRegistryState()
    const usedPrimitiveScalars = collectUsedPrimitiveScalars(context.schema)

    registerCustomScalars(registry, context.schema, context.customScalars)
    registerPrimitiveScalars(registry, usedPrimitiveScalars)
    registerEnums(registry, context.schema, registered.enums)
    registerFragments(registry, registered.fragment, context)

    return registry
}
