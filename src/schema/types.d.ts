export type TypeId = string

export type OperationType = 'query' | 'mutation' | 'subscription'

export type SchemaNamedTypeRef = {
    kind: 'named'
    type: TypeId
}

export type SchemaListTypeRef = {
    kind: 'list'
    ofType: SchemaTypeRef
}

export type SchemaNonNullTypeRef = {
    kind: 'non-null'
    ofType: SchemaNamedTypeRef | SchemaListTypeRef
}

export type SchemaTypeRef = SchemaNamedTypeRef | SchemaListTypeRef | SchemaNonNullTypeRef

type Described = {
    description?: string
}

type Deprecated = {
    deprecationReason?: string
}

export type SchemaInputValue = Described & Deprecated & {
    name: string
    type: SchemaTypeRef
    defaultValue?: string
}

export type SchemaField = Described & Deprecated & {
    name: string
    type: SchemaTypeRef
    arguments: ReadonlyArray<SchemaInputValue>
}

type SchemaNamedType = Described & {
    id: TypeId
}

export type SchemaScalarType = SchemaNamedType & {
    kind: 'scalar'
    specifiedByUrl?: string
}

export type SchemaEnumValue = Described & Deprecated & {
    name: string
    value: string
}

export type SchemaEnumType = SchemaNamedType & {
    kind: 'enum'
    values: ReadonlyArray<SchemaEnumValue>
}

export type SchemaObjectType = SchemaNamedType & {
    kind: 'object'
    supertypes: ReadonlyArray<TypeId>
    fields: ReadonlyArray<SchemaField>
}

export type SchemaInterfaceType = SchemaNamedType & {
    kind: 'interface'
    supertypes: ReadonlyArray<TypeId>
    subtypes: ReadonlyArray<TypeId>
    fields: ReadonlyArray<SchemaField>
}

export type SchemaUnionType = SchemaNamedType & {
    kind: 'union'
    subtypes: ReadonlyArray<TypeId>
}

export type SchemaInputObjectType = SchemaNamedType & {
    kind: 'input-object'
    oneOf: boolean
    fields: ReadonlyArray<SchemaInputValue>
}

export type SchemaType =
    | SchemaScalarType
    | SchemaEnumType
    | SchemaObjectType
    | SchemaInterfaceType
    | SchemaUnionType
    | SchemaInputObjectType

export type SchemaOutputType =
    | SchemaScalarType
    | SchemaEnumType
    | SchemaObjectType
    | SchemaInterfaceType
    | SchemaUnionType

export type SchemaInputType =
    | SchemaScalarType
    | SchemaEnumType
    | SchemaInputObjectType

export type SchemaDirective = Described & {
    name: string
    repeatable: boolean
    locations: ReadonlyArray<string>
    arguments: ReadonlyArray<SchemaInputValue>
}
