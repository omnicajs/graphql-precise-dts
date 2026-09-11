import type {
    GraphQLArgument,
    GraphQLDirective,
    GraphQLEnumType,
    GraphQLEnumValue,
    GraphQLField,
    GraphQLInputField,
    GraphQLInputType,
    GraphQLInterfaceType,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLType,
} from 'graphql'
import type {
    OperationType,
    SchemaDirective,
    SchemaEnumValue,
    SchemaField,
    SchemaInputValue,
    SchemaNonNullTypeRef,
    SchemaType,
    SchemaTypeRef,
    TypeId,
} from './types'
import type { SchemaSnapshotSource } from './view'

import {
    astFromValue,
    isEnumType,
    isInterfaceType,
    isListType,
    isNonNullType,
    isObjectType,
    isScalarType,
    isSpecifiedScalarType,
    isUnionType,
    print,
} from 'graphql'

type Described = {
    description?: string | null
}

type Deprecated = {
    deprecationReason?: string | null
}

const compareNames = <T extends { name: string }>(left: T, right: T): number => left.name.localeCompare(right.name)

const descriptionOf = (value: Described): { description?: string } => typeof value.description === 'string'
    ? { description: value.description }
    : {}

const deprecationOf = (value: Deprecated): { deprecationReason?: string } => (
    typeof value.deprecationReason === 'string'
        ? { deprecationReason: value.deprecationReason }
        : {}
)

const toTypeRef = (type: GraphQLType): SchemaTypeRef => {
    if (isNonNullType(type)) {
        return {
            kind: 'non-null',
            ofType: toTypeRef(type.ofType) as SchemaNonNullTypeRef['ofType'],
        }
    }

    if (isListType(type)) {
        return {
            kind: 'list',
            ofType: toTypeRef(type.ofType),
        }
    }

    return {
        kind: 'named',
        type: type.name,
    }
}

const serializeDefaultValue = (
    defaultValue: unknown,
    type: GraphQLInputType
): string | undefined => {
    if (defaultValue === undefined) return

    const valueNode = astFromValue(defaultValue, type)
    return print(valueNode!)
}

const toInputValue = (
    value: GraphQLArgument | GraphQLInputField
): SchemaInputValue => {
    const defaultValue = serializeDefaultValue(value.defaultValue, value.type)

    return {
        name: value.name,
        type: toTypeRef(value.type),
        ...descriptionOf(value),
        ...deprecationOf(value),
        ...(defaultValue === undefined ? {} : { defaultValue }),
    }
}

export const toSchemaField = (
    field: GraphQLField<unknown, unknown>
): SchemaField => ({
    name: field.name,
    type: toTypeRef(field.type),
    arguments: [ ...field.args ]
        .sort(compareNames)
        .map(toInputValue),
    ...descriptionOf(field),
    ...deprecationOf(field),
})

const getFields = (
    type: GraphQLObjectType | GraphQLInterfaceType
): ReadonlyArray<SchemaField> => Object.values(type.getFields())
    .sort(compareNames)
    .map(toSchemaField)

const toEnumValue = (value: GraphQLEnumValue): SchemaEnumValue => ({
    name: value.name,
    value: String(value.value),
    ...descriptionOf(value),
    ...deprecationOf(value),
})

const getEnumValues = (
    type: GraphQLEnumType
): ReadonlyArray<SchemaEnumValue> => type.getValues()
    .slice()
    .sort(compareNames)
    .map(toEnumValue)

const getScalarDescription = (
    type: Extract<GraphQLNamedType, { specifiedByURL?: string | null }>
): string | null | undefined => isSpecifiedScalarType(type)
    ? type.astNode?.description?.value
    : type.description

const getInterfaceSubtypes = (
    schema: GraphQLSchema,
    type: GraphQLInterfaceType
): ReadonlyArray<TypeId> => Object.values(schema.getTypeMap())
    .filter(schemaType => isObjectType(schemaType) || isInterfaceType(schemaType))
    .filter(schemaType => schemaType.getInterfaces().some(interfaceType => interfaceType.name === type.name))
    .map(schemaType => schemaType.name)
    .sort()

const toSchemaType = (
    schema: GraphQLSchema,
    type: GraphQLNamedType
): SchemaType => {
    if (isScalarType(type)) {
        const description = getScalarDescription(type)

        return {
            kind: 'scalar',
            id: type.name,
            ...(typeof description === 'string' ? { description } : {}),
            ...(type.specifiedByURL ? { specifiedByUrl: type.specifiedByURL } : {}),
        }
    }

    if (isEnumType(type)) {
        return {
            kind: 'enum',
            id: type.name,
            values: getEnumValues(type),
            ...descriptionOf(type),
        }
    }

    if (isObjectType(type)) {
        return {
            kind: 'object',
            id: type.name,
            supertypes: type.getInterfaces()
                .map(interfaceType => interfaceType.name)
                .sort(),
            fields: getFields(type),
            ...descriptionOf(type),
        }
    }

    if (isInterfaceType(type)) {
        return {
            kind: 'interface',
            id: type.name,
            supertypes: type.getInterfaces()
                .map(interfaceType => interfaceType.name)
                .sort(),
            subtypes: getInterfaceSubtypes(schema, type),
            fields: getFields(type),
            ...descriptionOf(type),
        }
    }

    if (isUnionType(type)) {
        return {
            kind: 'union',
            id: type.name,
            subtypes: type.getTypes()
                .map(subtype => subtype.name)
                .sort(),
            ...descriptionOf(type),
        }
    }

    return {
        kind: 'input-object',
        id: type.name,
        oneOf: type.isOneOf,
        fields: Object.values(type.getFields())
            .sort(compareNames)
            .map(toInputValue),
        ...descriptionOf(type),
    }
}

const toDirective = (directive: GraphQLDirective): SchemaDirective => ({
    name: directive.name,
    repeatable: directive.isRepeatable,
    locations: [ ...directive.locations ].sort(),
    arguments: [ ...directive.args ]
        .sort(compareNames)
        .map(toInputValue),
    ...descriptionOf(directive),
})

export class GraphQLSchemaView implements SchemaSnapshotSource {
    public constructor(private readonly schema: GraphQLSchema) {}

    public getRootType(operation: OperationType): TypeId | undefined {
        switch (operation) {
            case 'query':
                return this.schema.getQueryType()?.name
            case 'mutation':
                return this.schema.getMutationType()?.name
            case 'subscription':
                return this.schema.getSubscriptionType()?.name
        }
    }

    public getTypeIds(): ReadonlyArray<TypeId> {
        return Object.keys(this.schema.getTypeMap())
            .filter(typeId => !typeId.startsWith('__'))
            .sort()
    }

    public getType(type: TypeId): SchemaType {
        const schemaType = this.schema.getType(type)!

        return toSchemaType(this.schema, schemaType)
    }

    public getDirectives(): ReadonlyArray<SchemaDirective> {
        return this.schema.getDirectives()
            .slice()
            .sort(compareNames)
            .map(toDirective)
    }
}
