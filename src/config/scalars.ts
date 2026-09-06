import type {
    TsArrayType,
    TsGenericType,
    TsLiteralType,
    TsNamedType,
    TsNullType,
    TsObjectFieldConfig,
    TsObjectType,
    TsTupleType,
    TsType,
    TsUnknownType,
} from './ts-type'

const normalizeGroup = (
    kind: 'union' | 'intersection',
    types: ReadonlyArray<TsType>
): TsType => {
    const normalized = types.flatMap(type => {
        const current = normalizeType(type)

        return current.kind === kind ? current.types : [ current ]
    })
    const unique = new Map(normalized.map(type => [ JSON.stringify(type), type ]))
    const values = [ ...unique.values() ]

    return values.length === 1 ? values[0]! : { kind, types: values }
}

const normalizeType = (type: TsType): TsType => {
    switch (type.kind) {
        case 'array':
            return { kind: 'array', ofType: normalizeType(type.ofType) }
        case 'union':
        case 'intersection':
            return normalizeGroup(type.kind, type.types)
        case 'generic':
            return {
                kind: 'generic',
                name: type.name,
                arguments: type.arguments.map(normalizeType),
            }
        case 'object':
            return {
                kind: 'object',
                fields: type.fields.map(field => ({
                    ...field,
                    type: normalizeType(field.type),
                })),
            }
        case 'tuple':
            return { kind: 'tuple', items: type.items.map(normalizeType) }
        default:
            return type
    }
}

export function defineNamed(name: 'unknown'): TsUnknownType
export function defineNamed<const TName extends string>(name: TName): TsNamedType<TName>
export function defineNamed(name: string): TsNamedType | TsUnknownType {
    return name === 'unknown' ? defineUnknown() : { kind: 'named', name }
}

export const defineString = (): TsNamedType<'string'> => defineNamed('string')

export const defineNumber = (): TsNamedType<'number'> => defineNamed('number')

export const defineBoolean = (): TsNamedType<'boolean'> => defineNamed('boolean')

export const defineUnknown = (): TsUnknownType => ({ kind: 'unknown' })

export const defineNull = (): TsNullType => ({ kind: 'null' })

export const defineLiteral = <const TValue extends string | number | boolean>(
    value: TValue
): TsLiteralType<TValue> => ({ kind: 'literal', value })

export const arrayOf = (ofType: TsType): TsArrayType => ({
    kind: 'array',
    ofType: normalizeType(ofType),
})

export const unionOf = (first: TsType, ...rest: ReadonlyArray<TsType>): TsType => normalizeGroup(
    'union',
    [ first, ...rest ]
)

export const intersectionOf = (
    first: TsType,
    ...rest: ReadonlyArray<TsType>
): TsType => normalizeGroup('intersection', [ first, ...rest ])

export const defineGeneric = <const TName extends string>(
    name: TName,
    first: TsType,
    ...rest: ReadonlyArray<TsType>
): TsGenericType<TName> => ({
        kind: 'generic',
        name,
        arguments: [ first, ...rest ].map(normalizeType),
    })

export const defineObjectField = (
    type: TsType,
    optional = false
): TsObjectFieldConfig => ({
    type: normalizeType(type),
    optional,
})

export const defineObject = (
    fields: Readonly<Record<string, TsObjectFieldConfig>>
): TsObjectType => ({
    kind: 'object',
    fields: Object.entries(fields).map(([ name, field ]) => ({
        name,
        optional: field.optional,
        type: normalizeType(field.type),
    })),
})

export const defineTuple = (...items: ReadonlyArray<TsType>): TsTupleType => ({
    kind: 'tuple',
    items: items.map(normalizeType),
})

export const makeNullable = (type: TsType): TsType => unionOf(type, defineNull())
