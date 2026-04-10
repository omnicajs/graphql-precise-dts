import type { ConfigScalars } from '../config'
import type {
    EnumValueEntries,
    FragmentModel,
} from './types'
import type {
    GraphQLInputType,
    GraphQLInputObjectType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
} from 'graphql'
import type { ModelContext } from './types'
import type { ModelRegistry } from './registry'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ScalarModelShape } from './types'
import type { Scalars } from '../scalars/types'

import { getNamedType } from 'graphql'
import {
    getScalarPrimitiveShapeTs,
    getScalarTsShape,
} from '../scalars/builder'
import {
    isEnumType,
    isInputObjectType,
    isInterfaceType,
    isObjectType,
} from 'graphql'
import { isScalarPrimitiveKey } from '../scalars/builder'
import { isScalarType } from 'graphql'
import { makeFragmentModel } from './documents-builder'

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
