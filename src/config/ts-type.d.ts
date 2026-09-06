export type TsNamedType<TName extends string = string> = {
    kind: 'named'
    name: TName
}

export type TsNullType = {
    kind: 'null'
}

export type TsUnknownType = {
    kind: 'unknown'
}

export type TsArrayType = {
    kind: 'array'
    ofType: TsType
}

export type TsUnionType = {
    kind: 'union'
    types: ReadonlyArray<TsType>
}

export type TsIntersectionType = {
    kind: 'intersection'
    types: ReadonlyArray<TsType>
}

export type TsGenericType<TName extends string = string> = {
    kind: 'generic'
    name: TName
    arguments: ReadonlyArray<TsType>
}

export type TsObjectField = {
    name: string
    type: TsType
    optional: boolean
}

export type TsObjectFieldConfig = Omit<TsObjectField, 'name'>

export type TsObjectType = {
    kind: 'object'
    fields: ReadonlyArray<TsObjectField>
}

export type TsTupleType = {
    kind: 'tuple'
    items: ReadonlyArray<TsType>
}

export type TsLiteralType<
    TValue extends string | number | boolean = string | number | boolean,
> = {
    kind: 'literal'
    value: TValue
}

export type TsType =
    | TsNamedType
    | TsNullType
    | TsUnknownType
    | TsArrayType
    | TsUnionType
    | TsIntersectionType
    | TsGenericType
    | TsObjectType
    | TsTupleType
    | TsLiteralType
