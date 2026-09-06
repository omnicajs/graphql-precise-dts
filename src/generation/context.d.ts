import type { SchemaView } from '@/schema/view'
import type {
    DirectivePolicies,
    ScalarMappings,
    TypenamePolicy,
} from '@/config/types'
import type { FragmentIndex } from './fragments'
import type { GenerationDiagnostic } from './types'
import type { DocumentSource } from './types'

export type CompilationContext = {
    schema: SchemaView
    fragments: FragmentIndex
    scalars: ScalarMappings
    directives: DirectivePolicies
    typename?: TypenamePolicy
    sources: ReadonlyMap<string, DocumentSource>
    reportDiagnostic(diagnostic: GenerationDiagnostic): void
    sourceId: string
    sourcePath: string
}

export type CompilationEnvironment = Omit<
    CompilationContext,
    'reportDiagnostic' | 'sourceId' | 'sourcePath'
>
