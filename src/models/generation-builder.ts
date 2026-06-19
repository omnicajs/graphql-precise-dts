import type { CustomScalarMappingRecord } from '../scalars/types'
import type { EnumModel } from './types/type-ref'
import type { FragmentModel } from './types/document'
import type { GenerationModels } from './generation'
import type {
    GraphQLArgument,
    GraphQLField,
    GraphQLInputField,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLUnionType,
} from 'graphql'
import type { JsDoc } from '../render/jsdoc'
import type { ModelContext } from './types/context'
import type { NamedObjectField } from '../ts-type'
import type { ScalarModelShape } from './types/type-ref'
import type { Scalars } from '../scalars/types'
import type { Schema } from '../plugin-types'
import type {
    SchemaFieldArgTypeModel,
    SchemaObjectModel,
    SchemaOutputModel,
} from './generation'
import type { TsType } from '../ts-type'

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
        fieldArgTypes: [],
    },
    registry: {
        enums: new Map<string, EnumModel>(),
        fragments: new Map<string, FragmentModel>(),
    },
})

const makeJsDoc = (description?: string | null): JsDoc => description ? { description } : {}

const makeScalarReferenceRemark = (
    type: GraphQLInputType | GraphQLOutputType,
    usage: 'input' | 'output'
): string | undefined => {
    const namedType = getNamedType(type)

    return isScalarType(namedType)
        ? `Scalar reference: \`Scalars['${namedType.name}']['${usage}']\`.`
        : undefined
}

const addCustomScalars = (
    scalars: Map<string, ScalarModelShape>,
    schema: Schema,
    customScalars: CustomScalarMappingRecord
) => Object.keys(customScalars).forEach(scalarName => {
    const scalarType = schema.getType(scalarName)

    if (isScalarType(scalarType) && !scalars.has(scalarName)) {
        const description = isScalarPrimitiveKey(scalarType.name)
            ? scalarType.astNode?.description?.value
            : scalarType.description

        scalars.set(scalarName, {
            ...getScalarTsShape(scalarName, customScalars),
            ...(description && { description }),
            ...(scalarType.specifiedByURL && { specifiedByUrl: scalarType.specifiedByURL }),
        })
    }
})

const addPrimitiveScalars = (
    scalars: Map<string, ScalarModelShape>,
    schema: Schema,
    usedPrimitiveScalars: Set<keyof Scalars>
) => specifiedScalarTypes.forEach(({ name }) => {
    if (usedPrimitiveScalars.has(name as keyof Scalars) && !scalars.has(name)) {
        const scalarType = schema.getType(name)
        /* v8 ignore next -- @preserve used primitive scalars are collected from scalar schema types in valid GraphQLSchema instances. */
        const description = isScalarType(scalarType)
            ? scalarType.astNode?.description?.value
            : undefined
        /* v8 ignore next -- @preserve used primitive scalars are collected from scalar schema types in valid GraphQLSchema instances. */
        const specifiedByUrl = isScalarType(scalarType)
            ? scalarType.specifiedByURL
            : undefined

        scalars.set(name, {
            ...getScalarPrimitiveShapeTs(name as keyof Scalars),
            /* v8 ignore next -- @preserve GraphQL specified primitive scalars do not carry SDL descriptions in normal schemas. */
            ...(description && { description }),
            /* v8 ignore next -- @preserve GraphQL specified primitive scalars do not carry specifiedByUrl metadata in normal schemas. */
            ...(specifiedByUrl && { specifiedByUrl }),
        })
    }
})

const makeTypenameField = (typeName: string): NamedObjectField => ({
    name: '__typename',
    ...defineObjectField(defineLiteral(typeName), true),
})

const makeSchemaObjectType = (
    fields: NamedObjectField[],
    jsDoc: JsDoc = {}
): TsType => ({
    kind: TS_TYPE_KIND.OBJECT,
    fields,
    ...jsDoc,
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
): TsType => isListType(type)
    ? arrayTsType(makeSchemaTypeReference(
        enumReferences,
        scalars,
        type.ofType as GraphQLInputType | GraphQLOutputType,
        usage
    ))
    : makeNamedSchemaReference(enumReferences, scalars, getNamedType(type), usage)

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
    usage: 'input' | 'output',
    jsDoc: {
        description?: string | null;
        deprecationReason?: string | null;
    } = {}
): NamedObjectField => {
    const scalarReferenceRemark = makeScalarReferenceRemark(type, usage)

    return {
        name: fieldName,
        ...defineObjectField(
            makeSchemaTypeReference(enumReferences, scalars, type, usage),
            isNullableType(type),
            {
                ...(jsDoc.description && { description: jsDoc.description }),
                ...(jsDoc.deprecationReason && { deprecationReason: jsDoc.deprecationReason }),
                ...(scalarReferenceRemark && { remarks: scalarReferenceRemark }),
            }
        ),
    }
}

const makeOutputFields = (
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    typeName: string,
    fields: Record<string, GraphQLField<unknown, unknown>>,
    withTypename: boolean,
    jsDoc: JsDoc = {}
): TsType => makeSchemaObjectType([
    ...(withTypename ? [ makeTypenameField(typeName) ] : []),
    ...Object.values(fields).map(field =>
        makeSchemaObjectField(enumReferences, scalars, field.name, field.type, 'output', field)
    ),
], jsDoc)

const addFieldArgType = (
    fieldArgTypes: SchemaFieldArgTypeModel[],
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    parentTypeName: string,
    fieldName: string,
    args: readonly GraphQLArgument[]
) => {
    if (!args.length) return

    fieldArgTypes.push({
        parentTypeName,
        fieldName,
        type: makeSchemaObjectType(args.map(arg =>
            makeSchemaObjectField(enumReferences, scalars, arg.name, arg.type, 'input', arg)
        )),
    })
}

const addInputType = (
    inputTypes: Map<string, TsType>,
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLInputObjectType
) => inputTypes.set(
    type.name,
    makeSchemaObjectType(
        Object.values(type.getFields()).map((field: GraphQLInputField) =>
            makeSchemaObjectField(enumReferences, scalars, field.name, field.type, 'input', field)
        ),
        makeJsDoc(type.description)
    )
)

const addInterfaceType = (
    interfaceTypes: Map<string, TsType>,
    fieldArgTypes: SchemaFieldArgTypeModel[],
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLInterfaceType
) => {
    const fields = type.getFields()

    Object.values(fields).forEach(field => {
        addFieldArgType(fieldArgTypes, enumReferences, scalars, type.name, field.name, field.args)
    })

    interfaceTypes.set(type.name, makeOutputFields(
        enumReferences,
        scalars,
        type.name,
        fields,
        false,
        makeJsDoc(type.description)
    ))
}

const addObjectType = (
    objectTypes: Map<string, SchemaObjectModel>,
    fieldArgTypes: SchemaFieldArgTypeModel[],
    enumReferences: Set<string>,
    scalars: Map<string, ScalarModelShape>,
    type: GraphQLObjectType
) => {
    const fields = type.getFields()

    Object.values(fields).forEach(field => {
        addFieldArgType(fieldArgTypes, enumReferences, scalars, type.name, field.name, field.args)
    })

    objectTypes.set(type.name, {
        fields: makeOutputFields(
            enumReferences,
            scalars,
            type.name,
            fields,
            true
        ),
        interfaces: type.getInterfaces().map(({ name }) => name),
        ...(type.description && { description: type.description }),
    })
}

const addUnionType = (
    unionTypes: Map<string, TsType>,
    type: GraphQLUnionType
) => {
    unionTypes.set(
        type.name,
        {
            ...unionTsType(...type.getTypes().map(({ name }) => namedTsType(name))),
            ...(type.description && { description: type.description }),
        }
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
                    schemaOutput.fieldArgTypes,
                    schemaOutput.enumReferences,
                    schemaOutput.scalars,
                    type
                )
            }
            if (isObjectType(type)) {
                addObjectType(
                    schemaOutput.objectTypes,
                    schemaOutput.fieldArgTypes,
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
    enums: Map<string, EnumModel>,
    schema: Schema
) => Object.values(schema.getTypeMap()).forEach(type => {
    if (type.name.startsWith('__')) return

    if (isEnumType(type) && !enums.has(type.name)) {
        enums.set(type.name, {
            ...(type.description && { description: type.description }),
            entries: type.getValues().map(v => ({
                name: v.name,
                value: v.value,
                ...(v.description && { description: v.description }),
                ...(v.deprecationReason && { deprecationReason: v.deprecationReason }),
            })),
        })
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
    addPrimitiveScalars(schema.scalars, context.schema, usedPrimitiveScalars)
    addSchemaTypes(schema, context.schema)

    registerEnums(registry.enums, context.schema)
    registerFragments(registry.fragments, registeredNames.fragments, context)

    return { schema, registry }
}
