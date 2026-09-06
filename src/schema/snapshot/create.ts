import type { OperationType } from '@/schema/types'
import type { SchemaSnapshot } from './types'
import type { SchemaSnapshotSource } from '@/schema/view'

import { SCHEMA_SNAPSHOT_FORMAT_VERSION } from './values'

const operationTypes = [
    'query',
    'mutation',
    'subscription',
] as const satisfies ReadonlyArray<OperationType>

const compareNames = <T extends { name: string }>(left: T, right: T): number => left.name.localeCompare(right.name)

export const createSchemaSnapshot = (
    schema: SchemaSnapshotSource,
    schemaFingerprint: string
): SchemaSnapshot => {
    const snapshot: SchemaSnapshot = {
        formatVersion: SCHEMA_SNAPSHOT_FORMAT_VERSION,
        schemaFingerprint,
        rootTypes: Object.fromEntries(
            operationTypes.flatMap(operation => {
                const rootType = schema.getRootType(operation)

                return rootType ? [[ operation, rootType ]] : []
            })
        ),
        types: schema.getTypeIds()
            .slice()
            .sort()
            .map(type => schema.getType(type)),
        directives: schema.getDirectives()
            .slice()
            .sort(compareNames),
    }

    return snapshot
}
