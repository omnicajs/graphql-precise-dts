import type { ScalarMappings } from '@/config/types'
import type {
    SchemaSnapshot,
} from '@/schema/snapshot/types'
import type { SchemaTypeRef } from '@/schema/types'
import type { NamingConvention } from '@/generation/naming'

import { getScalarType } from '@/generation/scalars'

export type TypeUsage = 'input' | 'output'

const typeIndexes = new WeakMap<SchemaSnapshot, ReadonlyMap<string, SchemaSnapshot['types'][number]>>()

const typeIndex = (snapshot: SchemaSnapshot): ReadonlyMap<string, SchemaSnapshot['types'][number]> => {
    const cached = typeIndexes.get(snapshot)
    if (cached) return cached

    const created = new Map(snapshot.types.map(type => [ type.id, type ]))
    typeIndexes.set(snapshot, created)

    return created
}

export const renderNonNullType = (
    snapshot: SchemaSnapshot,
    ref: SchemaTypeRef,
    usage: TypeUsage,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => {
    if (ref.kind === 'non-null') {
        return renderNonNullType(snapshot, ref.ofType, usage, naming, scalars)
    }
    if (ref.kind === 'list') {
        return `Array<${renderSchemaType(snapshot, ref.ofType, usage, naming, scalars)}>`
    }

    const schemaType = typeIndex(snapshot).get(ref.type)
    if (schemaType?.kind === 'scalar') {
        return getScalarType(schemaType.id, scalars, usage) ?? 'unknown'
    }

    return naming.typeName(ref.type)
}

export const renderSchemaType = (
    snapshot: SchemaSnapshot,
    ref: SchemaTypeRef,
    usage: TypeUsage,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => ref.kind === 'non-null'
    ? renderNonNullType(snapshot, ref, usage, naming, scalars)
    : `${renderNonNullType(snapshot, ref, usage, naming, scalars)} | null`
