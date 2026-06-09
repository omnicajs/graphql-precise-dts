import type { JsDoc } from './render/jsdoc'

import { renderJsDoc } from './render/jsdoc'

export type TsType = (
    | { kind: typeof TS_TYPE_KIND.NAMED; name: string }
    | { kind: typeof TS_TYPE_KIND.NULL }
    | { kind: typeof TS_TYPE_KIND.UNKNOWN }
    | { kind: typeof TS_TYPE_KIND.ARRAY; ofType: TsType }
    | { kind: typeof TS_TYPE_KIND.UNION; types: TsType[] }
    | { kind: typeof TS_TYPE_KIND.INTERSECTION; types: TsType[] }
    | { kind: typeof TS_TYPE_KIND.GENERIC; name: string; args: TsType[] }
    | { kind: typeof TS_TYPE_KIND.OBJECT; fields: NamedObjectField[] }
    | { kind: typeof TS_TYPE_KIND.TUPLE; items: TsType[] }
    | { kind: typeof TS_TYPE_KIND.LITERAL; value: string | number | boolean }
) & JsDoc

export type NamedObjectField = {
    name: string;
} & ObjectFieldConfig

export type ObjectFieldConfig = JsDoc & {
    type: TsType;
    optional: boolean;
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

const tsKeywordTypeNames = new Set([
    'any',
    'bigint',
    'boolean',
    'never',
    'number',
    'object',
    'string',
    'symbol',
    'undefined',
    'unknown',
    'void',
])

export const isTsKeywordTypeName = (name: string): boolean => tsKeywordTypeNames.has(name)

const normalizeUnionTypes = (types: TsType[]): TsType[] => {
    const uniqueTypes = new Map<string, TsType>()

    for (const type of types.flatMap(current =>
        current.kind === TS_TYPE_KIND.UNION ? normalizeUnionTypes(current.types) : [ normalizeTsType(current) ]
    )) {
        uniqueTypes.set(renderTsType(type), type)
    }

    return [ ...uniqueTypes.values() ]
}

const normalizeIntersectionTypes = (types: TsType[]): TsType[] => {
    const uniqueTypes = new Map<string, TsType>()

    for (const type of types.flatMap(current =>
        current.kind === TS_TYPE_KIND.INTERSECTION
            ? normalizeIntersectionTypes(current.types)
            : [ normalizeTsType(current) ]
    )) {
        uniqueTypes.set(renderTsType(type), type)
    }

    return [ ...uniqueTypes.values() ]
}

export const normalizeTsType = (type: TsType): TsType => {
    switch (type.kind) {
        case TS_TYPE_KIND.ARRAY:
            return { kind: TS_TYPE_KIND.ARRAY, ofType: normalizeTsType(type.ofType) }
        case TS_TYPE_KIND.UNION: {
            const types = normalizeUnionTypes(type.types)
            return types.length === 1 ? types[0] : { kind: TS_TYPE_KIND.UNION, types }
        }
        case TS_TYPE_KIND.INTERSECTION: {
            const types = normalizeIntersectionTypes(type.types)
            return types.length === 1 ? types[0] : { kind: TS_TYPE_KIND.INTERSECTION, types }
        }
        case TS_TYPE_KIND.GENERIC:
            return {
                kind: TS_TYPE_KIND.GENERIC,
                name: type.name,
                args: type.args.map(normalizeTsType),
            }
        case TS_TYPE_KIND.OBJECT:
            return {
                kind: TS_TYPE_KIND.OBJECT,
                fields: type.fields.map(field => ({
                    ...field,
                    type: normalizeTsType(field.type),
                })),
            }
        case TS_TYPE_KIND.TUPLE:
            return {
                kind: TS_TYPE_KIND.TUPLE,
                items: type.items.map(normalizeTsType),
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
    const normalizedTypes = normalizeUnionTypes(types)

    return normalizedTypes.length === 1
        ? normalizedTypes[0]
        : {
            kind: TS_TYPE_KIND.UNION,
            types: normalizedTypes,
        }
}

export const intersectionTsType = (...types: TsType[]): TsType => {
    const normalizedTypes = normalizeIntersectionTypes(types)

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
                    ...type.fields.flatMap(field => {
                        const jsDoc = renderJsDoc(field, '\t')

                        return [
                            ...(jsDoc ? [ jsDoc ] : []),
                            `\t${field.name}${field.optional ? '?' : ''}: ${renderTsTypeWithParentPrecedence(field.type)};`,
                        ]
                    }),
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
    const canonicalType = normalizeTsType(type)

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

export const defineNamed = namedTsType
export const defineNull = nullTsType
export const arrayOf = arrayTsType
export const unionOf = unionTsType
export const intersectionOf = intersectionTsType
export const defineGeneric = genericTsType
export const defineTuple = tupleTsType
export const defineString = (): TsType => namedTsType('string')
export const defineNumber = (): TsType => namedTsType('number')
export const defineBoolean = (): TsType => namedTsType('boolean')
export const defineUnknown = (): TsType => namedTsType('unknown')
export const defineLiteral = (value: string | number | boolean): TsType => ({ kind: TS_TYPE_KIND.LITERAL, value })
export const defineObjectField = (type: TsType, optional = false, jsDoc: JsDoc = {}): ObjectFieldConfig => ({
    type,
    optional,
    ...jsDoc,
})
export const defineObject = (fields: { [key: string]: ObjectFieldConfig }): TsType => ({
    kind: TS_TYPE_KIND.OBJECT,
    fields: Object.entries(fields).map(([ name, field ]) => ({
        name,
        ...field,
    })),
})

export const renderType = renderTsType
export const makeNullable = makeNullableTsType
