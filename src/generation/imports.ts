import type {
    DocumentSource,
    ParsedDocumentSource,
} from './types'

import { CompilationError } from './errors'

export const validateDocumentImports = (
    source: ParsedDocumentSource,
    sources: ReadonlyMap<string, DocumentSource>
): void => {
    for (const imported of source.imports) {
        if (imported.external) {
            throw new CompilationError(
                'invalid-document-import',
                `Document import "${imported.specifier}" is outside the project root`,
                imported.location
            )
        }

        const provider = sources.get(imported.sourcePath)
        if (!provider) {
            throw new CompilationError(
                'invalid-document-import',
                `Imported document "${imported.specifier}" is not selected by this target`,
                imported.location
            )
        }
        if (!provider.document) {
            throw new CompilationError(
                'invalid-document-import',
                `Imported document "${imported.specifier}" is unavailable`,
                imported.location
            )
        }
    }
}
