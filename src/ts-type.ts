export type TsType =
    | { kind: typeof TS_TYPE_KIND.NAMED; name: string }
    | { kind: typeof TS_TYPE_KIND.NULL }
    | { kind: typeof TS_TYPE_KIND.UNKNOWN }
    | { kind: typeof TS_TYPE_KIND.ARRAY; ofType: TsType }
    | { kind: typeof TS_TYPE_KIND.UNION; types: TsType[] }
    | { kind: typeof TS_TYPE_KIND.INTERSECTION; types: TsType[] }
    | { kind: typeof TS_TYPE_KIND.GENERIC; name: string; args: TsType[] }
    | { kind: typeof TS_TYPE_KIND.OBJECT; fields: TsObjectField[] }
    | { kind: typeof TS_TYPE_KIND.TUPLE; items: TsType[] }
    | { kind: typeof TS_TYPE_KIND.LITERAL; value: string | number | boolean }

export type TsObjectField = {
    name: string;
    type: TsType;
    optional?: boolean;
}

export const TS_TYPE_KIND = {
    NAMED: 'named',
    NULL: 'null',
    UNKNOWN: 'unknown',
    ARRAY: 'array',
    UNION: 'union',
    INTERSECTION: 'intersection',
    GENERIC: 'generic',
    OBJECT: 'object',
    TUPLE: 'tuple',
    LITERAL: 'literal',
} as const

const canonicalizeUnionTypes = (types: TsType[]): TsType[] => {
    const uniqueTypes = new Map<string, TsType>()

    for (const type of types.flatMap(current =>
        current.kind === TS_TYPE_KIND.UNION ? canonicalizeUnionTypes(current.types) : [ canonicalizeTsType(current) ]
    )) {
        uniqueTypes.set(renderTsType(type), type)
    }

    return [ ...uniqueTypes.values() ]
}

const canonicalizeIntersectionTypes = (types: TsType[]): TsType[] => {
    const uniqueTypes = new Map<string, TsType>()

    for (const type of types.flatMap(current =>
        current.kind === TS_TYPE_KIND.INTERSECTION
            ? canonicalizeIntersectionTypes(current.types)
            : [ canonicalizeTsType(current) ]
    )) {
        uniqueTypes.set(renderTsType(type), type)
    }

    return [ ...uniqueTypes.values() ]
}

export const canonicalizeTsType = (type: TsType): TsType => {
    switch (type.kind) {
        case TS_TYPE_KIND.ARRAY:
            return { kind: TS_TYPE_KIND.ARRAY, ofType: canonicalizeTsType(type.ofType) }
        case TS_TYPE_KIND.UNION: {
            const types = canonicalizeUnionTypes(type.types)
            return types.length === 1 ? types[0] : { kind: TS_TYPE_KIND.UNION, types }
        }
        case TS_TYPE_KIND.INTERSECTION: {
            const types = canonicalizeIntersectionTypes(type.types)
            return types.length === 1 ? types[0] : { kind: TS_TYPE_KIND.INTERSECTION, types }
        }
        case TS_TYPE_KIND.GENERIC:
            return {
                kind: TS_TYPE_KIND.GENERIC,
                name: type.name,
                args: type.args.map(canonicalizeTsType),
            }
        case TS_TYPE_KIND.OBJECT:
            return {
                kind: TS_TYPE_KIND.OBJECT,
                fields: type.fields.map(field => ({
                    ...field,
                    type: canonicalizeTsType(field.type),
                })),
            }
        case TS_TYPE_KIND.TUPLE:
            return {
                kind: TS_TYPE_KIND.TUPLE,
                items: type.items.map(canonicalizeTsType),
            }
        default:
            return type
    }
}

export const namedTsType = (name: string): TsType => name === 'unknown'
    ? { kind: TS_TYPE_KIND.UNKNOWN }
    : { kind: TS_TYPE_KIND.NAMED, name }

export const nullTsType = (): TsType => ({ kind: TS_TYPE_KIND.NULL })

export const arrayTsType = (ofType: TsType): TsType => ({ kind: TS_TYPE_KIND.ARRAY, ofType })

export const unionTsType = (...types: TsType[]): TsType => {
    const normalizedTypes = canonicalizeUnionTypes(types)

    return normalizedTypes.length === 1
        ? normalizedTypes[0]
        : {
            kind: TS_TYPE_KIND.UNION,
            types: normalizedTypes,
        }
}

export const intersectionTsType = (...types: TsType[]): TsType => {
    const normalizedTypes = canonicalizeIntersectionTypes(types)

    return normalizedTypes.length === 1
        ? normalizedTypes[0]
        : {
            kind: TS_TYPE_KIND.INTERSECTION,
            types: normalizedTypes,
        }
}

export const genericTsType = (name: string, ...args: TsType[]): TsType => ({
    kind: TS_TYPE_KIND.GENERIC,
    name,
    args,
})

export const tupleTsType = (...items: TsType[]): TsType => ({
    kind: TS_TYPE_KIND.TUPLE,
    items,
})

const getTsTypePrecedence = (type: TsType): number => {
    switch (type.kind) {
        case TS_TYPE_KIND.UNION:
            return 1
        case TS_TYPE_KIND.INTERSECTION:
            return 2
        default:
            return 3
    }
}

const renderTsTypeWithParentPrecedence = (type: TsType, parentPrecedence = 0): string => {
    const rendered = (() => {
        switch (type.kind) {
            case TS_TYPE_KIND.NAMED:
                return type.name
            case TS_TYPE_KIND.NULL:
                return 'null'
            case TS_TYPE_KIND.UNKNOWN:
                return 'unknown'
            case TS_TYPE_KIND.ARRAY:
                return `Array<${renderTsTypeWithParentPrecedence(type.ofType)}>`
            case TS_TYPE_KIND.UNION:
                return type.types.map(current => renderTsTypeWithParentPrecedence(current, getTsTypePrecedence(type)))
                    .join(' | ')
            case TS_TYPE_KIND.INTERSECTION:
                return type.types.map(current => renderTsTypeWithParentPrecedence(current, getTsTypePrecedence(type)))
                    .join(' & ')
            case TS_TYPE_KIND.GENERIC:
                return `${type.name}<${type.args.map(arg => renderTsTypeWithParentPrecedence(arg)).join(', ')}>`
            case TS_TYPE_KIND.OBJECT:
                return [
                    '{',
                    ...type.fields.map(
                        field => `\t${field.name}${field.optional ? '?' : ''}: ${renderTsTypeWithParentPrecedence(field.type)};`
                    ),
                    '}',
                ].join('\n')
            case TS_TYPE_KIND.TUPLE:
                return `[${type.items.map(item => renderTsTypeWithParentPrecedence(item)).join(', ')}]`
            case TS_TYPE_KIND.LITERAL:
                return typeof type.value === 'string' ? `'${type.value}'` : String(type.value)
        }
    })()

    return getTsTypePrecedence(type) < parentPrecedence ? `(${rendered})` : rendered
}

export const renderTsType = (type: TsType): string => renderTsTypeWithParentPrecedence(type)

const normalizeComparableTsType = (type: TsType): TsType => {
    const canonicalType = canonicalizeTsType(type)

    switch (canonicalType.kind) {
        case TS_TYPE_KIND.ARRAY:
            return {
                ...canonicalType,
                ofType: normalizeComparableTsType(canonicalType.ofType),
            }
        case TS_TYPE_KIND.UNION:
        case TS_TYPE_KIND.INTERSECTION:
            return {
                ...canonicalType,
                types: [ ...canonicalType.types ]
                    .map(normalizeComparableTsType)
                    .sort((left, right) => renderTsType(left).localeCompare(renderTsType(right))),
            }
        case TS_TYPE_KIND.GENERIC:
            return {
                ...canonicalType,
                args: canonicalType.args.map(normalizeComparableTsType),
            }
        case TS_TYPE_KIND.OBJECT:
            return {
                ...canonicalType,
                fields: canonicalType.fields.map(field => ({
                    ...field,
                    type: normalizeComparableTsType(field.type),
                })),
            }
        case TS_TYPE_KIND.TUPLE:
            return {
                ...canonicalType,
                items: canonicalType.items.map(normalizeComparableTsType),
            }
        default:
            return canonicalType
    }
}

export const isSameTsType = (left: TsType, right: TsType): boolean => {
    return renderTsType(normalizeComparableTsType(left)) === renderTsType(normalizeComparableTsType(right))
}

export const makeNullableTsType = (type: TsType): TsType => unionTsType(type, nullTsType())

export const namedType = namedTsType
export const nullType = nullTsType
export const arrayOf = arrayTsType
export const unionOf = unionTsType
export const intersectionOf = intersectionTsType
export const genericType = genericTsType
export const tupleType = tupleTsType
export const stringType = (): TsType => namedTsType('string')
export const numberType = (): TsType => namedTsType('number')
export const booleanType = (): TsType => namedTsType('boolean')
export const unknownType = (): TsType => namedTsType('unknown')
export const literalType = (value: string | number | boolean): TsType => ({ kind: TS_TYPE_KIND.LITERAL, value })
export const objectType = (fields: TsObjectField[]): TsType => ({
    kind: TS_TYPE_KIND.OBJECT,
    fields,
})

export const renderType = renderTsType
export const makeNullableType = makeNullableTsType
