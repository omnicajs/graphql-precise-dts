export enum TypeRefKind {
    NAMED = 'named',
    LIST = 'list',
    NON_NULL = 'non-null',
}

export enum ValueModelKind {
    SCALAR = 'scalar',
    TYPENAME = 'typename',
    ENUM = 'enum',
    UNION = 'union',
    OBJECT = 'object',
    UNKNOWN = 'unknown',
}

export enum SelectionModelKind {
    FIELD = 'field',
    FRAGMENT_SPREAD = 'fragmentSpread',
    INLINE_FRAGMENT = 'inlineFragment',
}

export enum FragmentRootKind {
    OBJECT = 'object',
    UNION = 'union',
}
