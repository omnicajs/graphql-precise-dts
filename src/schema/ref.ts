import type {
    SchemaTypeRef,
    TypeId,
} from './types'

export const getNamedType = (type: SchemaTypeRef): TypeId => type.kind === 'named'
    ? type.type
    : getNamedType(type.ofType)
