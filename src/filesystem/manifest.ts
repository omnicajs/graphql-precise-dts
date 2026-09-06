import type {
    DeclarationFile,
    OutputManifest,
    OutputManifestFile,
} from './types'

import {
    isArrayOf,
    isRecord,
    isString,
} from '@/predicates'
import { createHash } from 'node:crypto'

export const OUTPUT_MANIFEST_FILE = '.graphql-precise-dts-manifest.json'

const outputKinds = new Set<unknown>([
    'document-declaration',
    'aggregate-declaration',
    'schema-types',
    'schema-enums',
])

const isOutputManifestFile = (value: unknown): value is OutputManifestFile => isRecord(value)
    && isString(value.path)
    && outputKinds.has(value.kind)
    && isString(value.contentHash)

const isOutputManifest = (value: unknown): value is OutputManifest => isRecord(value)
    && value.formatVersion === 1
    && isArrayOf(value.files, isOutputManifestFile)

export const parseOutputManifest = (source: string, file: string): OutputManifest => {
    let value: unknown

    try {
        value = JSON.parse(source)
    } catch {
        throw new Error(`Output manifest "${file}" is not valid JSON`)
    }

    if (isRecord(value) && value.formatVersion !== 1) {
        throw new Error(`Output manifest "${file}" has an unsupported format version`)
    }
    if (!isOutputManifest(value)) throw new Error(`Output manifest "${file}" is invalid`)

    return value
}

export const makeContentHash = (content: string): string => `sha256:${createHash('sha256')
    .update(content)
    .digest('hex')}`

export const makeOutputManifest = (
    files: ReadonlyArray<DeclarationFile & { path: string }>
): OutputManifest => ({
    formatVersion: 1,
    files: files
        .map(file => ({
            path: file.path,
            kind: file.kind,
            contentHash: makeContentHash(file.content),
        }))
        .sort((left, right) => left.path.localeCompare(right.path)),
})

export const renderOutputManifest = (manifest: OutputManifest): string => `${JSON.stringify(
    manifest,
    undefined,
    4
)}\n`
