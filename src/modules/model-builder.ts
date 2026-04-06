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
import type { FragmentModel } from '../types/models'
import type {
    GraphQLInputType,
    GraphQLSchema,
} from 'graphql'
import type {
    InputFieldModel,
    InputValueModel,
} from '../types/models'
import type { OperationDefinitionNode } from 'graphql'
import type { OperationModel } from '../types/models'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ScalarModel } from '../types/models'
import type { Scalars } from '../types/scalars'
import type { SelectionNode } from 'graphql'
import type { TypeFieldNode } from '../types/selection'
import type { TypeRef } from '../types/models'
import type { TypeSelectionNode } from '../types/selection'
import type { VariableDefinitionNode } from 'graphql'

import { TypeInfo } from 'graphql'

import { capitalize } from '../lib/string'
import {
    filterSelectionsForConcreteType,
    getFragmentTypeNames,
} from './type-resolution'
import { getNamedType } from 'graphql'
import { getScalarPrimitiveShapeTs } from './scalar-ts'
import { isScalarPrimitiveKey } from './scalar-ts'
import { getScalarTsShape } from './scalar-ts'
import { getScalarTsType } from './scalar-ts'
import { getTypeForDefinition } from './type-resolution'
import { isConditionalSelectionState } from './directives'
import {
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isListType,
    isNonNullType,
    isObjectType,
    isScalarType,
    isUnionType,
} from 'graphql'
import { makeTypeRefForField } from './type-resolution'
import {
    resolveSelectionDirectives,
    shouldForceNonNull,
} from './directives'
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
import { TypeRefKind } from '../enums/model-kinds'

import { selectionStates } from './directives'
import { specifiedScalarTypes } from 'graphql'

const makeNonNullTypeRef = (typeRef: TypeRef): TypeRef => {
    return typeRef.kind === TypeRefKind.NON_NULL
        ? typeRef
        : {
            kind: TypeRefKind.NON_NULL,
            ofType: typeRef,
        }
}

const makeTypeRefForInput = (type: GraphQLInputType): TypeRef => {
    if (isNonNullType(type)) {
        return {
            kind: TypeRefKind.NON_NULL,
            ofType: makeTypeRefForInput(type.ofType),
        } as const
    }

    if (isListType(type)) {
        return {
            kind: TypeRefKind.LIST,
            ofType: makeTypeRefForInput(type.ofType),
        } as const
    }

    return {
        kind: TypeRefKind.NAMED,
        name: getNamedType(type).name,
    } as const
}

const emitDirectiveWarnings = (warnings: string[]) => warnings.forEach(message => console.warn(message))

const collectUsedPrimitiveScalars = (
    schema: Parameters<PluginFunction<PluginConfig>>[0]
): Set<keyof Scalars> => {
    const usedScalars = new Set<keyof Scalars>()

    Object.values(schema.getTypeMap()).forEach(type => {
        if (type.name.startsWith('__')) return

        if (isObjectType(type) || isInterfaceType(type)) {
            Object.values(type.getFields()).forEach(field => {
                const outputType = getNamedType(field.type)

                if (isScalarType(outputType) && isScalarPrimitiveKey(outputType.name)) {
                    usedScalars.add(outputType.name as keyof Scalars)
                }

                field.args.forEach(argument => {
                    const inputType = getNamedType(argument.type)

                    if (isScalarType(inputType) && isScalarPrimitiveKey(inputType.name)) {
                        usedScalars.add(inputType.name as keyof Scalars)
                    }
                })
            })
        }

        if (isInputObjectType(type)) {
            Object.values(type.getFields()).forEach(field => {
                const inputType = getNamedType(field.type)

                if (isScalarType(inputType) && isScalarPrimitiveKey(inputType.name)) {
                    usedScalars.add(inputType.name as keyof Scalars)
                }
            })
        }
    })

    return usedScalars
}

export const findFragmentsDefs = (
    documents: Parameters<PluginFunction<PluginConfig>>[1]
): Map<string, FragmentDefinitionNode> => {
    const fragments = new Map<string, FragmentDefinitionNode>()

    documents.forEach(({ document }) => document?.definitions
        .filter(d => Kind.FRAGMENT_DEFINITION === d.kind)
        .forEach(f => {
            if (!fragments.get(f.name.value)) fragments.set(f.name.value, f)
        })
    )

    return fragments
}

const makeFieldModel = (
    type: TypeFieldNode,
    field: FieldNode,
    schema: GraphQLSchema,
    fragmentsDefs: Map<string, FragmentDefinitionNode>,
    customScalars: ConfigScalar,
    directivePolicies: ConfigDirectivePolicies
): FieldValueModel => {
    const namedType = getNamedType(type.currentType)

    if (field.name.value === '__typename' && type.typeNames?.length) {
        return { kind: FieldValueKind.TYPENAME, typeNames: type.typeNames }
    } else if (isScalarType(namedType)) {
        return { kind: FieldValueKind.SCALAR, typeTs: getScalarTsType(namedType.name, customScalars) }
    } else if (isEnumType(namedType)) {
        return { kind: FieldValueKind.ENUM, name: namedType.name }
    } else if (isInterfaceType(namedType)) {
        const selections = field.selectionSet?.selections
        const hasExplicitTypeName = selections?.some(selection =>
            selection.kind === Kind.FIELD && selection.name.value === '__typename'
        )

        if (selections && type.selections && hasExplicitTypeName) {
            return {
                kind: FieldValueKind.UNION,
                variants: schema.getPossibleTypes(namedType).map(possibleType => ({
                    typeName: possibleType.name,
                    fields: specializeTypeNameSelectionForConcreteType(
                        makeDefinitionsModel(
                            filterSelectionsForConcreteType(schema, possibleType, [ ...selections ]),
                            type.selections as WeakMap<SelectionNode, TypeSelectionNode>,
                            schema,
                            fragmentsDefs,
                            customScalars,
                            directivePolicies
                        ),
                        possibleType.name
                    ),
                })),
            }
        }

        return {
            kind: FieldValueKind.OBJECT,
            typeNames: schema.getPossibleTypes(namedType).map(type => type.name),
            fields: selections && type.selections
                ? makeDefinitionsModel(
                    [ ...selections ],
                    type.selections,
                    schema,
                    fragmentsDefs,
                    customScalars,
                    directivePolicies
                )
                : [],
        }
    } else if (isObjectType(namedType)) {
        return {
            kind: FieldValueKind.OBJECT,
            typeNames: [ namedType.name ],
            fields: field.selectionSet?.selections && type.selections
                ? makeDefinitionsModel(
                    [ ...field.selectionSet.selections ],
                    type.selections,
                    schema,
                    fragmentsDefs,
                    customScalars,
                    directivePolicies
                )
                : [],
        }
    } else if (isUnionType(namedType)) {
        return {
            kind: FieldValueKind.UNION,
            variants: field.selectionSet?.selections
                ? field.selectionSet.selections.map(s => {
                    if (s.kind !== Kind.INLINE_FRAGMENT) return

                    const typedSelection = type.selections?.get(s)
                    if (!typedSelection || typedSelection.kind !== DefinitionNodeKind.INLINE_FRAGMENT) return
                    if (!typedSelection.selections) return

                    const typeName = s.typeCondition?.name.value ?? typedSelection.typeCondition
                    if (!typeName) return

                    return {
                        typeName,
                        fields: makeDefinitionsModel(
                            [ ...s.selectionSet.selections ],
                            typedSelection.selections,
                            schema,
                            fragmentsDefs,
                            customScalars,
                            directivePolicies
                        ),
                    }
                }).filter(s => s !== undefined)
                : [],
        }
    }

    return { kind: FieldValueKind.UNKNOWN, reason: 'Unknown type' }
}

const makeDefinitionsModel = (
    selections: SelectionNode[] = [],
    typesForSelectionsNode: WeakMap<SelectionNode, TypeSelectionNode>,
    schema: GraphQLSchema,
    fragmentsDefs: Map<string, FragmentDefinitionNode>,
    customScalars: ConfigScalar,
    directivePolicies: ConfigDirectivePolicies
): DefinitionNodeModel[] => {
    const defs: DefinitionNodeModel[] = []

    selections.forEach(s => {
        const targetKind = Kind.FIELD === s.kind
            ? DefinitionNodeKind.FIELD
            : Kind.FRAGMENT_SPREAD === s.kind
                ? DefinitionNodeKind.FRAGMENT_SPREAD
                : DefinitionNodeKind.INLINE_FRAGMENT
        const resolvedDirectives = resolveSelectionDirectives(
            s.directives ? [ ...s.directives ] : [],
            targetKind,
            directivePolicies
        )
        if (resolvedDirectives.state === selectionStates.EXCLUDED) return
        emitDirectiveWarnings(resolvedDirectives.warnings)
        const isConditional = isConditionalSelectionState(resolvedDirectives.state)

        const fieldType = typesForSelectionsNode.get(s)
        if (!fieldType) return

        if (Kind.FIELD === s.kind && DefinitionNodeKind.FIELD === fieldType.kind) {
            const typeRef = makeTypeRefForField(s.name.value, fieldType.currentType)

            defs.push({
                kind: DefinitionNodeKind.FIELD,
                name: s.name.value,
                responseName: s.alias?.value ?? s.name.value,
                typeRef: shouldForceNonNull(
                    s.directives ? [ ...s.directives ] : [],
                    DefinitionNodeKind.FIELD,
                    directivePolicies
                )
                    ? makeNonNullTypeRef(typeRef)
                    : typeRef,
                value: makeFieldModel(fieldType, s, schema, fragmentsDefs, customScalars, directivePolicies),
                conditional: isConditional,
                overrideTypeTs: resolvedDirectives.overrideTypeTs,
                directives: resolvedDirectives.directives,
            })
        }

        if (Kind.FRAGMENT_SPREAD === s.kind && DefinitionNodeKind.FRAGMENT_SPREAD === fieldType.kind) {
            const spreadFragment = fragmentsDefs.get(s.name.value)
            if (!spreadFragment) return

            defs.push({
                kind: DefinitionNodeKind.FRAGMENT_SPREAD,
                name: s.name.value,
                ...getFragmentTypeNames(spreadFragment, schema),
                conditional: isConditional,
                directives: resolvedDirectives.directives,
            })
        }

        if (Kind.INLINE_FRAGMENT === s.kind && DefinitionNodeKind.INLINE_FRAGMENT === fieldType.kind && fieldType.selections) {
            defs.push({
                kind: DefinitionNodeKind.INLINE_FRAGMENT,
                ...(s.typeCondition?.name.value && { typeCondition: s.typeCondition.name.value }),
                selections: makeDefinitionsModel(
                    [ ...s.selectionSet.selections ],
                    fieldType.selections,
                    schema,
                    fragmentsDefs,
                    customScalars,
                    directivePolicies
                ),
                conditional: isConditional,
                directives: resolvedDirectives.directives,
            })
        }
    })

    return defs
}

const makeFragmentModel = (
    graphqlDef: FragmentDefinitionNode,
    schema: GraphQLSchema,
    fragmentsDefs: Map<string, FragmentDefinitionNode>,
    customScalars: ConfigScalar,
    directivePolicies: ConfigDirectivePolicies
): FragmentModel => {
    const fragmentType = schema.getType(graphqlDef.typeCondition.name.value)
    const selections = [ ...graphqlDef.selectionSet.selections ]
    const selectionTypes = getTypeForDefinition(graphqlDef, schema)
    const hasTypeSpecificInlineFragments = selections.some(selection =>
        selection.kind === Kind.INLINE_FRAGMENT && !!selection.typeCondition
    )

    if (
        fragmentType
        && (isInterfaceType(fragmentType) || isUnionType(fragmentType))
        && hasTypeSpecificInlineFragments
    ) {
        return {
            ...getFragmentTypeNames(graphqlDef, schema),
            root: {
                kind: FragmentRootKind.UNION,
                variants: schema.getPossibleTypes(fragmentType).map(type => ({
                    typeName: type.name,
                    fields: specializeTypeNameSelectionForConcreteType(
                        makeDefinitionsModel(
                            filterSelectionsForConcreteType(schema, type, selections),
                            selectionTypes,
                            schema,
                            fragmentsDefs,
                            customScalars,
                            directivePolicies
                        ),
                        type.name
                    ),
                })),
            },
        }
    }

    return {
        ...getFragmentTypeNames(graphqlDef, schema),
        root: {
            kind: FragmentRootKind.OBJECT,
            fields: makeDefinitionsModel(
                selections,
                selectionTypes,
                schema,
                fragmentsDefs,
                customScalars,
                directivePolicies
            ),
        },
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
                value: makeInputValueModel(field.type, customScalars),
            })),
        }
    }

    return { kind: FieldValueKind.UNKNOWN, reason: 'Unknown input type' }
}

const makeOperationVariableModel = (
    variableDefinition: VariableDefinitionNode,
    type: GraphQLInputType,
    customScalars: ConfigScalar
): InputFieldModel => ({
    name: variableDefinition.variable.name.value,
    typeRef: makeTypeRefForInput(type),
    value: makeInputValueModel(type, customScalars),
})

const getRootTypeForOperation = (
    operation: OperationTypeNode,
    schema: GraphQLSchema
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
    schema: GraphQLSchema,
    fragmentsDefs: Map<string, FragmentDefinitionNode>,
    customScalars: ConfigScalar,
    directivePolicies: ConfigDirectivePolicies
): OperationModel | undefined => {
    const rootType = getRootTypeForOperation(graphqlDef.operation, schema)
    if (!rootType) return

    const selectionTypes = getTypeForDefinition(graphqlDef, schema)
    const variables = new WeakMap<VariableDefinitionNode, GraphQLInputType>()
    const typeInfo = new TypeInfo(schema)

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
                    ? [ makeOperationVariableModel(variableDefinition, variableType, customScalars) ]
                    : []
            }),
        result: makeDefinitionsModel(
            [ ...graphqlDef.selectionSet.selections ],
            selectionTypes,
            schema,
            fragmentsDefs,
            customScalars,
            directivePolicies
        ),
    }
}

export const buildDefinitionRegistry = (
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    registered: {
        fragment: string[],
        enums: string[],
    },
    customScalars: ConfigScalar,
    directivePolicies: ConfigDirectivePolicies = {}
): DefRegistry => {
    const scalars = new Map<string, ScalarModel>()
    const enums = new Map<string, EnumDefinitionModel>()
    const fragments = new Map<string, FragmentModel>()

    const fragmentsDefs = findFragmentsDefs(documents)
    const usedPrimitiveScalars = collectUsedPrimitiveScalars(schema)

    Object.keys(customScalars).forEach(scalarName => {
        const scalarType = schema.getType(scalarName)

        if (isScalarType(scalarType) && !scalars.get(scalarName)) {
            scalars.set(scalarName, getScalarTsShape(scalarName, customScalars))
        }
    })

    registered.enums.forEach(enumName => {
        const enumType = schema.getType(enumName)

        if (isEnumType(enumType) && !enums.get(enumName)) {
            enums.set(enumName, enumType.getValues().map(v => ({ name: v.name, value: v.value })))
        }
    })

    for (const [ key, def ] of fragmentsDefs.entries()) {
        if (registered.fragment.includes(key) && !fragments.get(key)) {
            fragments.set(key, makeFragmentModel(
                def,
                schema,
                fragmentsDefs,
                customScalars,
                directivePolicies
            ))
        }
    }

    specifiedScalarTypes.forEach(({ name }) => {
        if (!usedPrimitiveScalars.has(name as keyof Scalars) || scalars.get(name)) return

        scalars.set(name, getScalarPrimitiveShapeTs(name as keyof Scalars))
    })

    return { fragments, enums, scalars }
}
