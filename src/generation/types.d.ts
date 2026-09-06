import type { DocumentNode } from 'graphql'
import type {
    DirectivePolicies,
    ExecutionConfig,
    NamingPolicy,
    TypenamePolicy,
    ScalarMappings,
} from '@/config/types'
import type { SchemaSnapshot } from '@/schema/snapshot/types'

export type DocumentImport = {
    sourceId: string
    sourcePath: string
    specifier: string
    external: boolean
    location: SourceLocation
}

type DocumentSourceIdentity = {
    id: string
    path: string
    imports: ReadonlyArray<DocumentImport>
}

export type ParsedDocumentSource = DocumentSourceIdentity & {
    document: DocumentNode
}

export type DocumentSource = ParsedDocumentSource | DocumentSourceIdentity & {
    document?: never
}

export type DiagnosticSeverity = 'error' | 'warning'

export type DiagnosticCode =
    | 'ambiguous-fragment-provider'
    | 'directive-warning'
    | 'invalid-document-import'
    | 'invalid-document'
    | 'missing-fragment-provider'
    | 'repeated-field-selection'
    | 'repeated-fragment-spread'
    | 'scalar-name-conflict'
    | 'skipped-document'
    | 'unsupported-document'
    | 'unsupported-schema-type'
    | 'unavailable-fragment-provider'

export type SourceLocation = {
    line: number
    column: number
}

export type GenerationDiagnostic = {
    severity: DiagnosticSeverity
    code: DiagnosticCode
    sourceId: string
    location?: SourceLocation
    message: string
}

export type GeneratedDeclarationOutput = {
    sourceId: string
    content: string
    aggregateContent?: string
}

export type GeneratedBundleResult = {
    output?: GeneratedDeclarationOutput
    diagnostics: ReadonlyArray<GenerationDiagnostic>
}

export type SchemaInput = {
    snapshot: SchemaSnapshot
    typesModule: string
    enumsModule?: string
    scalars?: ScalarMappings
    directives?: DirectivePolicies
    naming?: NamingPolicy
    typename?: TypenamePolicy
}

export type ModuleRendering = {
    paths: Readonly<Record<string, string>>
    aggregate: boolean
}

export type GenerateDeclarationsInput = {
    projectId: string
    schema: SchemaInput
    documents: ReadonlyArray<DocumentSource>
    execution?: ExecutionConfig
    rendering?: ModuleRendering
}

export type GenerateDeclarationsResult = {
    projectId: string
    outputs: ReadonlyArray<GeneratedDeclarationOutput>
    diagnostics: ReadonlyArray<GenerationDiagnostic>
}
