import type { FragmentModel } from './types/document'
import type { GenerationModels } from './generation'
import type { ModelContext } from './types/context'
import type { Schema } from '../plugin-types'

import type {
    CustomScalarMappingRecord,
    Scalars,
} from '../scalars/types'

import type {
    EnumValueEntries,
    ScalarModelShape,
} from './types/type-ref'

import type {
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
} from 'graphql'

import { makeFragmentModel } from './documents-builder'
import {
    getScalarPrimitiveShapeTs,
    getScalarTsShape,
    isScalarPrimitiveKey,
} from '../scalars/builder'

import {
    getNamedType,
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isObjectType,
    isScalarType,
} from 'graphql'

import { specifiedScalarTypes } from 'graphql'

type RegisteredNames = {
    fragments: string[];
    enums: string[];
}

const createGenerationModels = (): GenerationModels => ({
    schema: {
        scalars: new Map<string, ScalarModelShape>(),
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
    schema: Schema,
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

    registerEnums(registry.enums, context.schema, registeredNames.enums)
    registerFragments(registry.fragments, registeredNames.fragments, context)

    return { schema, registry }
}
