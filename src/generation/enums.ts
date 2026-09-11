import type { SchemaEnumType } from '@/schema/types'
import type { CompiledEnumValue, CompiledScalarValue } from './model'
import { renderType } from './render/type'

// Introspection enums belong to GraphQL itself, not to the user's schema module.
export const compileEnumValue = (type: SchemaEnumType): CompiledEnumValue | CompiledScalarValue => {
    if (!type.id.startsWith('__')) return { kind: 'enum', type: type.id }

    return {
        kind: 'scalar',
        type: renderType({
            kind: 'union',
            types: type.values.map(value => ({ kind: 'literal', value: value.name })),
        }),
    }
}
