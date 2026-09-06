import type {
    CacheConfig,
    SchemaConfig,
} from '@/config/types'
import type {
    LoadedSchemaSource,
    ResolvedSchema,
} from './types'
import type { SchemaSnapshot } from '@/schema/snapshot/types'

import packageJson from '../../package.json'
import { createHash } from 'node:crypto'
import { createSchemaSnapshot } from '@/schema/snapshot/create'
import {
    existsSync,
    readFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import {
    assertValidSchema,
    buildSchema,
    version as graphqlVersion,
} from 'graphql'
import { isRecord } from '@/predicates'
import { loadSchemaSource } from './schema'
import { parseSchemaSnapshot } from '@/schema/snapshot/parse'
import { GraphQLSchemaView } from '@/schema/graphql'
import { writeAtomically } from './write'

const CACHE_FORMAT_VERSION = 2
const defaultCacheDirectory = '.graphql-precise-dts/cache'

const contentHash = (content: string): string => (
    `sha256:${createHash('sha256').update(content).digest('hex')}`
)

const stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stableValue)
    if (!isRecord(value)) return value

    return Object.fromEntries(Object.keys(value)
        .sort()
        .filter(key => value[key] !== undefined)
        .map(key => [ key, stableValue(value[key]) ]))
}

const snapshotContentHash = (snapshot: SchemaSnapshot): string => (
    contentHash(JSON.stringify(stableValue(snapshot)))
)

const semanticConfigHash = (schema: SchemaConfig): string => contentHash(JSON.stringify(stableValue({
    directives: schema.directives,
    naming: schema.naming,
    typename: schema.typename,
    scalars: schema.scalars,
})))

const cacheFile = (
    root: string,
    schemaId: string,
    cache: CacheConfig | undefined
): string => {
    const safeSchemaId = /^[A-Za-z0-9._-]+$/.test(schemaId) && schemaId !== '.' && schemaId !== '..'
        ? schemaId
        : Buffer.from(schemaId).toString('base64url')

    return resolve(
        root,
        cache?.directory ?? defaultCacheDirectory,
        'schemas',
        `${safeSchemaId}.json`
    )
}

const readCachedSnapshot = (
    file: string,
    schemaId: string,
    source: LoadedSchemaSource,
    configHash: string
): SchemaSnapshot | undefined => {
    if (!existsSync(file)) return

    let entry: unknown
    try {
        entry = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
        return
    }

    if (!isRecord(entry)
        || entry.formatVersion !== CACHE_FORMAT_VERSION
        || entry.generatorVersion !== packageJson.version
        || entry.graphqlVersion !== graphqlVersion
        || entry.schemaId !== schemaId
        || entry.schemaFingerprint !== source.fingerprint
        || entry.semanticConfigHash !== configHash) return

    let snapshot: SchemaSnapshot
    try {
        snapshot = parseSchemaSnapshot(entry.snapshot)
    } catch {
        return
    }

    if (entry.snapshotHash !== snapshotContentHash(snapshot)) return

    return snapshot
}

const buildSnapshot = (source: LoadedSchemaSource): SchemaSnapshot => {
    const schema = buildSchema(source.contents)
    assertValidSchema(schema)

    return createSchemaSnapshot(new GraphQLSchemaView(schema), source.fingerprint)
}

const renderCacheEntry = (
    schemaId: string,
    source: LoadedSchemaSource,
    configHash: string,
    snapshot: SchemaSnapshot
): string => `${JSON.stringify({
    formatVersion: CACHE_FORMAT_VERSION,
    generatorVersion: packageJson.version,
    graphqlVersion,
    schemaId,
    schemaFingerprint: source.fingerprint,
    semanticConfigHash: configHash,
    snapshotHash: snapshotContentHash(snapshot),
    snapshot,
}, null, 2)}\n`

export const resolveCachedSchema = ({
    root,
    schemaId,
    schema,
    cache,
    writeCache,
}: {
    root: string
    schemaId: string
    schema: SchemaConfig
    cache?: CacheConfig
    writeCache: boolean
}): ResolvedSchema => {
    const source = loadSchemaSource(root, schema)
    const enabled = cache?.enabled !== false
    const file = cacheFile(root, schemaId, cache)
    const configHash = semanticConfigHash(schema)
    const cached = enabled
        ? readCachedSnapshot(file, schemaId, source, configHash)
        : undefined
    const snapshot = cached ?? buildSnapshot(source)

    if (enabled && !cached && writeCache) {
        writeAtomically(file, renderCacheEntry(schemaId, source, configHash, snapshot))
    }

    return {
        input: {
            snapshot,
            typesModule: schema.typesModule,
            enumsModule: schema.enumsModule,
            scalars: schema.scalars,
            directives: schema.directives,
            naming: schema.naming,
            typename: schema.typename,
        },
        snapshot,
    }
}
