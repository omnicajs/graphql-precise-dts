export const DIRECTIVE_POLICY_EFFECT = {
    IGNORE: 'ignore',
    EXCLUDE: 'exclude',
    CONDITIONAL: 'conditional',
    NONNULL: 'nonnull',
    OVERRIDE_TYPE: 'override-type',
    WARN: 'warn',
} as const

export const CONDITIONAL_DIRECTIVE = {
    INCLUDE: 'include',
    SKIP: 'skip',
} as const

export const SELECTION_STATE = {
    INCLUDED: 'included',
    EXCLUDED: 'excluded',
    CONDITIONAL: 'conditional',
} as const
