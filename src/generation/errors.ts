import type { GenerationDiagnostic } from './types'
import type { ASTNode } from 'graphql'
import type { SourceLocation } from './types'

import { getSourceLocation } from './diagnostics/location'

type DiagnosticOrigin = ASTNode | SourceLocation

const resolveLocation = (origin: DiagnosticOrigin): SourceLocation => (
    'line' in origin ? origin : getSourceLocation(origin)
)

export class CompilationError extends Error {
    public constructor(
        public readonly code: GenerationDiagnostic['code'],
        message: string,
        origin: DiagnosticOrigin
    ) {
        super(message)
        this.name = 'CompilationError'
        this.location = resolveLocation(origin)
    }

    public readonly location: GenerationDiagnostic['location']
}

export const unsupportedDocument = (message: string, origin: DiagnosticOrigin): never => {
    throw new CompilationError('unsupported-document', message, origin)
}

export const invalidDocument = (message: string, origin: DiagnosticOrigin): never => {
    throw new CompilationError('invalid-document', message, origin)
}

export const unsupportedSchemaType = (message: string, origin: DiagnosticOrigin): never => {
    throw new CompilationError('unsupported-schema-type', message, origin)
}
