import type {
    SchemaDirective,
    SchemaEnumValue,
    SchemaField,
    SchemaInputValue,
    SchemaListTypeRef,
    SchemaNamedTypeRef,
    SchemaNonNullTypeRef,
    SchemaType,
    SchemaTypeRef,
} from '@/schema/types'
import type { SchemaSnapshot } from './types'

import { InvalidSchemaSnapshotError } from './errors'
import { SCHEMA_SNAPSHOT_FORMAT_VERSION } from './values'
import { z } from 'zod'

const string = z.string()
const description = string.optional()
const deprecationReason = string.optional()

const namedTypeRef: z.ZodType<SchemaNamedTypeRef> = z.strictObject({
    kind: z.literal('named'),
    type: string,
})

const typeRef: z.ZodType<SchemaTypeRef> = z.lazy(() => z.union([
    namedTypeRef,
    listTypeRef,
    nonNullTypeRef,
]))

const listTypeRef: z.ZodType<SchemaListTypeRef> = z.strictObject({
    kind: z.literal('list'),
    ofType: typeRef,
})

const nullableTypeRef: z.ZodType<SchemaNonNullTypeRef['ofType']> = z.lazy(
    () => z.union([ namedTypeRef, listTypeRef ])
)

const nonNullTypeRef: z.ZodType<SchemaNonNullTypeRef> = z.strictObject({
    kind: z.literal('non-null'),
    ofType: nullableTypeRef,
})

const inputValue: z.ZodType<SchemaInputValue> = z.strictObject({
    name: string,
    type: typeRef,
    description,
    deprecationReason,
    defaultValue: string.optional(),
})

const field: z.ZodType<SchemaField> = z.strictObject({
    name: string,
    type: typeRef,
    arguments: z.array(inputValue),
    description,
    deprecationReason,
})

const enumValue: z.ZodType<SchemaEnumValue> = z.strictObject({
    name: string,
    value: string,
    description,
    deprecationReason,
})

const schemaType: z.ZodType<SchemaType> = z.discriminatedUnion('kind', [
    z.strictObject({
        kind: z.literal('scalar'),
        id: string,
        description,
        specifiedByUrl: string.optional(),
    }),
    z.strictObject({
        kind: z.literal('enum'),
        id: string,
        description,
        values: z.array(enumValue),
    }),
    z.strictObject({
        kind: z.literal('object'),
        id: string,
        description,
        supertypes: z.array(string),
        fields: z.array(field),
    }),
    z.strictObject({
        kind: z.literal('interface'),
        id: string,
        description,
        supertypes: z.array(string),
        subtypes: z.array(string),
        fields: z.array(field),
    }),
    z.strictObject({
        kind: z.literal('union'),
        id: string,
        description,
        subtypes: z.array(string),
    }),
    z.strictObject({
        kind: z.literal('input-object'),
        id: string,
        description,
        oneOf: z.boolean(),
        fields: z.array(inputValue),
    }),
])

const directive: z.ZodType<SchemaDirective> = z.strictObject({
    name: string,
    description,
    repeatable: z.boolean(),
    locations: z.array(string),
    arguments: z.array(inputValue),
})

const snapshot: z.ZodType<SchemaSnapshot> = z.strictObject({
    formatVersion: z.literal(SCHEMA_SNAPSHOT_FORMAT_VERSION),
    schemaFingerprint: string,
    rootTypes: z.strictObject({
        query: string.optional(),
        mutation: string.optional(),
        subscription: string.optional(),
    }),
    types: z.array(schemaType),
    directives: z.array(directive),
})

export const parseSchemaSnapshot = (value: unknown): SchemaSnapshot => {
    const result = snapshot.safeParse(value)
    if (!result.success) {
        throw new InvalidSchemaSnapshotError('Schema snapshot has an invalid structure')
    }

    return result.data
}
