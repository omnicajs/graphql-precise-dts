import type { FragmentModel } from './types/document'
import type { ModelContext } from './types/context'
import type { ModelRegistry } from './registry'
import type { Schema } from '../plugin-types'

import type {
    CustomScalarMappings,
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
    schema: Schema,
    customScalars: CustomScalarMappings
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

export const buildModelRegistry = (
    registeredNames: RegisteredNames,
    context: ModelContext,
    customScalars: CustomScalarMappings = {}
): ModelRegistry => {
    const registry = createModelRegistry()
    const usedPrimitiveScalars = collectUsedPrimitiveScalars(context.schema)

    registerCustomScalars(registry.schema.scalars, context.schema, customScalars)
    registerPrimitiveScalars(registry.schema.scalars, usedPrimitiveScalars)
    registerEnums(registry.schema.enums, context.schema, registeredNames.enums)
    registerFragments(registry.documents.fragments, registeredNames.fragments, context)

    return registry
}
