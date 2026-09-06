import type {
    GenerateDeclarationsInput,
    GenerateDeclarationsResult,
    ParsedDocumentSource,
} from './types'

import { compileDocument } from './compile'
import { indexFragments } from './fragments'
import { createIndex as createFragmentIndex } from './plan/fragments'
import { SnapshotSchemaView } from '@/schema/snapshot/view'
import { scheduleGenerationBundles } from './schedule'

export const generateDeclarations = ({
    projectId,
    schema,
    documents,
    execution,
    rendering,
}: GenerateDeclarationsInput): Promise<GenerateDeclarationsResult> => {
    const outputs: GenerateDeclarationsResult['outputs'][number][] = []
    const diagnostics: GenerateDeclarationsResult['diagnostics'][number][] = []
    const parsedDocuments = documents.filter(
        (source): source is ParsedDocumentSource => source.document !== undefined
    )
    const fragments = indexFragments(parsedDocuments)
    const sources = new Map(documents.map(source => [ source.path, source ]))
    const view = new SnapshotSchemaView(schema.snapshot)
    const context = {
        schema: view,
        fragments,
        sources,
        scalars: schema.scalars ?? {},
        directives: schema.directives ?? {},
        typename: schema.typename,
    }
    const compilations = parsedDocuments.map(source => compileDocument(source, context))
    const compiledDocuments = compilations.flatMap(
        result => 'document' in result ? [ result.document ] : []
    )
    const compiledFragments = createFragmentIndex(compiledDocuments)

    return scheduleGenerationBundles(
        compilations,
        execution,
        compiledFragments,
        schema,
        rendering
    ).then(results => {
        for (const result of results) {
            diagnostics.push(...result.diagnostics)
            if (result.output) outputs.push(result.output)
        }

        return {
            projectId,
            outputs,
            diagnostics,
        }
    })
}
