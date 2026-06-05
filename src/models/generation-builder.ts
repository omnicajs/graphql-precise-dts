import type { CustomScalarMappingRecord } from '../scalars/types'
import type { EnumValueEntries } from './types/type-ref'
import type { FragmentModel } from './types/document'
import type { GenerationModels } from './generation'
import type {
    GraphQLArgument,
    GraphQLField,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLUnionType,
} from 'graphql'
import type { ModelContext } from './types/context'
import type { NamedObjectField } from '../ts-type'
import type { ScalarModelShape } from './types/type-ref'
import type { Scalars } from '../scalars/types'
import type { Schema } from '../plugin-types'
import type {
    SchemaObjectModel,
    SchemaOutputModel,
} from './generation'
import type { TsType } from '../ts-type'

import { capitalize } from '../lib/strings'
import {
    getScalarPrimitiveShapeTs,
    getScalarTsShape,
    isScalarPrimitiveKey,
} from '../scalars/builder'
import { makeFragmentModel } from './documents-builder'

import {
    arrayTsType,
    makeNullableTsType,
    namedTsType,
    defineLiteral,
    defineObjectField,
    unionTsType,
} from '../ts-type'

import {
    getNamedType,
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isListType,
    isNonNullType,
    isNullableType,
    isObjectType,
    isScalarType,
    isUnionType,
} from 'graphql'

import { TS_TYPE_KIND } from '../ts-type'

import { specifiedScalarTypes } from 'graphql'

type RegisteredNames = {
    fragments: string[];
    enums: string[];
}

const createGenerationModels = (): GenerationModels => ({
    schema: {
        enumReferences: new Set<string>(),
        scalars: new Map<string, ScalarModelShape>(),
        inputTypes: new Map<string, TsType>(),
        interfaceTypes: new Map<string, TsType>(),
        objectTypes: new Map<string, SchemaObjectModel>(),
        unionTypes: new Map<string, TsType>(),
        fieldArgs: new Map<string, TsType>(),
    },
    registry: {
        enums: new Map<string, EnumValueEntries>(),
        fragments: new Map<string, FragmentModel>(),
    },
})

const addCustomScalars = (
    scalars: Map<string, ScalarModelShape>,
    schema: Schema,
    customScalars: CustomScalarMappingRecord
) => Object.keys(customScalars).forEach(scalarName => {
    const scalarType = schema.getType(scalarName)

    if (isScalarType(scalarType) && !scalars.has(scalarName)) {
        scalars.set(scalarName, getScalarTsShape(scalarName, customScalars))
    }
})

const addPrimitiveScalars = (
    scalars: Map<string, ScalarModelShape>,
    usedPrimitiveScalars: Set<keyof Scalars>
) => specifiedScalarTypes.forEach(({ name }) => {
    if (usedPrimitiveScalars.has(name as keyof Scalars) && !scalars.has(name)) {
        scalars.set(name, getScalarPrimitiveShapeTs(name as keyof Scalars))
    }
})

const makeTypenameField = (typeName: string): NamedObjectField => ({
    name: '__typename',
    ...defineObjectField(defineLiteral(typeName), true),
})

const makeSchemaObjectType = (fields: NamedObjectField[]): TsType => ({
    kind: TS_TYPE_KIND.OBJECT,
    fields,
})

const makeScalarReference = (
    scalars: Map<string, ScalarModelShape>,
    scalarName: string,
    usage: 'input' | 'output'
): TsType => namedTsType(scalars.get(scalarName)?.[usage] ?? 'unknown')

const makeNamedSchemaReference = (
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    namedType: GraphQLNamedType,
    usage: 'input' | 'output'
): TsType => {
    if (isScalarType(namedType)) return makeScalarReference(scalars, namedType.name, usage)
    if (isEnumType(namedType)) enumReferences.add(namedType.name)

    return namedTsType(namedType.name)
}

const makeNonNullableSchemaTypeReference = (
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLInputType | GraphQLOutputType,
    usage: 'input' | 'output'
): TsType => {
    if (isNonNullType(type)) return makeNonNullableSchemaTypeReference(enumReferences, scalars, type.ofType, usage)

    return isListType(type)
        ? arrayTsType(makeSchemaTypeReference(
            enumReferences,
            scalars,
            type.ofType as GraphQLInputType | GraphQLOutputType,
            usage
        ))
        : makeNamedSchemaReference(enumReferences, scalars, getNamedType(type), usage)
}

const makeSchemaTypeReference = (
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLInputType | GraphQLOutputType,
    usage: 'input' | 'output'
): TsType => isNonNullType(type)
    ? makeNonNullableSchemaTypeReference(enumReferences, scalars, type.ofType, usage)
    : makeNullableTsType(makeNonNullableSchemaTypeReference(enumReferences, scalars, type, usage))

const makeSchemaObjectField = (
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    fieldName: string,
    type: GraphQLInputType | GraphQLOutputType,
    usage: 'input' | 'output'
): NamedObjectField => ({
    name: fieldName,
    ...defineObjectField(
        makeSchemaTypeReference(enumReferences, scalars, type, usage),
        isNullableType(type)
    ),
})

const makeOutputFields = (
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    typeName: string,
    fields: Record<string, GraphQLField<unknown, unknown>>,
    withTypename: boolean
): TsType => makeSchemaObjectType([
    ...(withTypename ? [ makeTypenameField(typeName) ] : []),
    ...Object.values(fields).map(field => makeSchemaObjectField(enumReferences, scalars, field.name, field.type, 'output')),
])

const makeFieldArgsName = (
    typeName: string,
    fieldName: string
): string => `${typeName}${capitalize(fieldName)}Args`

const addFieldArgs = (
    fieldArgs: Map<string, TsType>,
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    parentTypeName: string,
    fieldName: string,
    args: readonly GraphQLArgument[]
) => {
    if (!args.length) return

    fieldArgs.set(
        makeFieldArgsName(parentTypeName, fieldName),
        makeSchemaObjectType(args.map(arg => makeSchemaObjectField(enumReferences, scalars, arg.name, arg.type, 'input')))
    )
}

const addInputType = (
    inputTypes: Map<string, TsType>,
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLInputObjectType
) => inputTypes.set(
    type.name,
    makeSchemaObjectType(Object.values(type.getFields()).map(field =>
        makeSchemaObjectField(enumReferences, scalars, field.name, field.type, 'input')
    ))
)

const addInterfaceType = (
    interfaceTypes: Map<string, TsType>,
    fieldArgs: Map<string, TsType>,
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLInterfaceType
) => {
    const fields = type.getFields()

    Object.values(fields).forEach(field => {
        addFieldArgs(fieldArgs, enumReferences, scalars, type.name, field.name, field.args)
    })

    interfaceTypes.set(type.name, makeOutputFields(enumReferences, scalars, type.name, fields, false))
}

const addObjectType = (
    objectTypes: Map<string, SchemaObjectModel>,
    fieldArgs: Map<string, TsType>,
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLObjectType
) => {
    const fields = type.getFields()

    Object.values(fields).forEach(field => {
        addFieldArgs(fieldArgs, enumReferences, scalars, type.name, field.name, field.args)
    })

    objectTypes.set(type.name, {
        fields: makeOutputFields(enumReferences, scalars, type.name, fields, true),
        interfaces: type.getInterfaces().map(({ name }) => name),
    })
}

const addUnionType = (
    unionTypes: Map<string, TsType>,
    type: GraphQLUnionType
) => {
    unionTypes.set(
        type.name,
        unionTsType(...type.getTypes().map(({ name }) => namedTsType(name)))
    )
}

const addSchemaTypes = (
    schemaOutput: SchemaOutputModel,
    schema: Schema
) => {
    Object.values(schema.getTypeMap())
        .filter(type => !type.name.startsWith('__'))
        .forEach(type => {
            if (isInputObjectType(type)) addInputType(schemaOutput.inputTypes, schemaOutput.enumReferences, schemaOutput.scalars, type)
            if (isInterfaceType(type)) {
                addInterfaceType(
                    schemaOutput.interfaceTypes,
                    schemaOutput.fieldArgs,
                    schemaOutput.enumReferences,
                    schemaOutput.scalars,
                    type
                )
            }
            if (isObjectType(type)) {
                addObjectType(
                    schemaOutput.objectTypes,
                    schemaOutput.fieldArgs,
                    schemaOutput.enumReferences,
                    schemaOutput.scalars,
                    type
                )
            }
            if (isUnionType(type)) addUnionType(schemaOutput.unionTypes, type)
        })
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
    schema: Schema
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

const registerEnums = (
    enums: Map<string, EnumValueEntries>,
    schema: Schema
) => Object.values(schema.getTypeMap()).forEach(type => {
    if (type.name.startsWith('__')) return

    if (isEnumType(type) && !enums.has(type.name)) {
        enums.set(type.name, type.getValues().map(v => ({
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
    for (const [key, def] of context.fragmentDefinitions.entries()) {
        if (importFragmentsName.includes(key) && !fragments.has(key)) {
            fragments.set(key, makeFragmentModel(def, context))
        }
    }
}

export const buildGenerationModels = (
    registeredNames: RegisteredNames,
    context: ModelContext,
    customScalars: CustomScalarMappingRecord = {}
): GenerationModels => {
    const { schema, registry } = createGenerationModels()
    const usedPrimitiveScalars = collectUsedPrimitiveScalars(context.schema)

    addCustomScalars(schema.scalars, context.schema, customScalars)
    addPrimitiveScalars(schema.scalars, usedPrimitiveScalars)
    addSchemaTypes(schema, context.schema)

    registerEnums(registry.enums, context.schema)
    registerFragments(registry.fragments, registeredNames.fragments, context)

    return { schema, registry }
}
