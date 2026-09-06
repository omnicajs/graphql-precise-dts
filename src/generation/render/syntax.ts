import type {
    SchemaNonNullTypeRef,
    SchemaTypeRef,
} from '@/schema/types'

export const renderNullableType = (type: SchemaTypeRef, value: string): string => {
    switch (type.kind) {
        case 'named':
            return `${value} | null`
        case 'list':
            return `Array<${renderNullableType(type.ofType, value)}> | null`
        case 'non-null':
            return renderNonNullType(type.ofType, value)
    }
}

const renderNonNullType = (type: SchemaNonNullTypeRef['ofType'], value: string): string => {
    switch (type.kind) {
        case 'named':
            return value
        case 'list':
            return `Array<${renderNullableType(type.ofType, value)}>`
    }
}

export const escapeModuleSpecifier = (value: string): string => value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
