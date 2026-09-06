import type { DocumentNode } from 'graphql'
import type { SchemaInput } from '@/generation/types'
import type { SchemaSnapshot } from '@/schema/snapshot/types'
import type { SourceLocation } from '@/generation/types'

export type LoadedDocumentImport = {
    specifier: string
    file: string
    id: string
    external: boolean
    location: SourceLocation
}

export type LoadedDocument = {
    file: string
    id: string
    imports: ReadonlyArray<LoadedDocumentImport>
    document: DocumentNode
} | {
    file: string
    id: string
    imports: ReadonlyArray<LoadedDocumentImport>
    document?: never
    error: {
        message: string
        location?: {
            line: number
            column: number
        }
    }
}

export type LoadedSchemaSource = {
    contents: string
    fingerprint: string
}

export type ResolvedSchema = {
    input: SchemaInput
    snapshot: SchemaSnapshot
}

export type DeclarationFile = {
    kind: OutputManifestFile['kind']
    file: string
    content: string
}

export type DeclarationTree = {
    root: string
    files: ReadonlyArray<DeclarationFile>
}

export type PreparedDeclarationFile = DeclarationFile & {
    absoluteFile: string
    path: string
}

export type PreparedDeclarationTree = {
    root: string
    manifestFile: string
    previousManifest: OutputManifest | undefined
    files: ReadonlyArray<PreparedDeclarationFile>
}

export type OutputManifestFile = {
    path: string
    kind: 'document-declaration' | 'aggregate-declaration' | 'schema-types' | 'schema-enums'
    contentHash: string
}

export type OutputManifest = {
    formatVersion: 1
    files: ReadonlyArray<OutputManifestFile>
}
