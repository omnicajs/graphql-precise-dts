import type { GenerationDiagnostic as CoreGenerationDiagnostic } from './generation/types'

type GeneratedOutput = {
    kind: string
    schemaId: string
    file: string
    content: string
}

export type GeneratedDeclarationOutput = GeneratedOutput & {
    kind: 'document-declaration'
    projectId: string
    targetId: string
    sourceId: string
}

export type GeneratedAggregateOutput = GeneratedOutput & {
    kind: 'aggregate-declaration'
    projectId: string
    targetId: string
    sourceId?: never
}

export type GeneratedSchemaOutput = GeneratedOutput & {
    kind: 'schema-types' | 'schema-enums'
    projectId?: never
    targetId?: never
    sourceId?: never
}

export type GenerationOutput = GeneratedDeclarationOutput
    | GeneratedAggregateOutput
    | GeneratedSchemaOutput

export type GenerationDiagnostic = CoreGenerationDiagnostic & { schemaId: string } & (
    | {
        projectId: string
        targetId: string
    }
    | {
        projectId?: never
        targetId?: never
    }
)

export type GenerateDeclarationsOptions = {
    /** Overwrite planned outputs, remove stale owned files, and warn about preserved unowned files. */
    force?: boolean
}

export type PublicationWarning = {
    code: 'dirty-output'
    root: string
    files: ReadonlyArray<string>
}

export type GenerateDeclarationsResult = {
    outputs: ReadonlyArray<GenerationOutput>
    diagnostics: ReadonlyArray<GenerationDiagnostic>
    /** Present when forced publication preserves undeclared files in output areas. */
    warnings?: ReadonlyArray<PublicationWarning>
}

export type DeclarationDifference = {
    kind: 'missing' | 'changed' | 'stale' | 'modified' | 'unowned'
    file: string
}

export type CheckDeclarationsResult = GenerateDeclarationsResult & {
    differences: ReadonlyArray<DeclarationDifference>
}
