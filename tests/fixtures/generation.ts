import type { DocumentSelector, SchemaConfig } from '@/index'

import { defineConfig, generateDeclarations } from '@/index'

export const generateFixtureProject = async ({
    root,
    projectId,
    schema,
    documentsRoot,
    documents,
}: {
    root: string
    projectId: string
    schema: SchemaConfig
    documentsRoot: string
    documents: DocumentSelector
}) => {
    const result = await generateDeclarations(defineConfig({
        root,
        schemas: { fixture: schema },
        projects: {
            [projectId]: {
                root: documentsRoot,
                targets: {
                    fixture: {
                        schema: 'fixture',
                        documents,
                        outputs: { tree: { root: 'generated' } },
                    },
                },
            },
        },
    }))

    return {
        projectId,
        outputs: result.outputs.map(({ sourceId, content }) => ({ sourceId, content })),
        diagnostics: result.diagnostics.map(diagnostic => ({
            severity: diagnostic.severity,
            code: diagnostic.code,
            sourceId: diagnostic.sourceId,
            message: diagnostic.message,
        })),
    }
}
