import type {
    OperationType,
    SchemaDirective,
    SchemaType,
    TypeId,
} from '@/schema/types'
import type { SCHEMA_SNAPSHOT_FORMAT_VERSION } from './values'

export type SchemaSnapshot = {
    formatVersion: typeof SCHEMA_SNAPSHOT_FORMAT_VERSION
    schemaFingerprint: string
    rootTypes: Partial<Record<OperationType, TypeId>>
    types: ReadonlyArray<SchemaType>
    directives: ReadonlyArray<SchemaDirective>
}
