export const TYPE_REF_KIND = {
    NAMED: 'named',
    LIST: 'list',
    NON_NULL: 'non-null',
} as const

export const VALUE_MODEL_KIND = {
    SCALAR: 'scalar',
    TYPENAME: 'typename',
    ENUM: 'enum',
    UNION: 'union',
    OBJECT: 'object',
    UNKNOWN: 'unknown',
} as const

export const SELECTION_MODEL_KIND = {
    FIELD: 'field',
    FRAGMENT_SPREAD: 'fragmentSpread',
    INLINE_FRAGMENT: 'inlineFragment',
} as const

export const FRAGMENT_ROOT_KIND = {
    OBJECT: 'object',
    UNION: 'union',
} as const
