import type { createFixtureWorkspace } from './workspace'
import type { SchemaConfig } from '@/index'

import { buildSchema, parse, validate } from 'graphql'
import { resolve } from 'node:path'

import { defineUnknown } from '@/index'
import { generateFixtureProject } from './generation'

export const createStandardFixture = (workspace: ReturnType<typeof createFixtureWorkspace>) => {
    const schemaFile = 'schemas/standard/schema.graphql'
    const documentsRoot = 'projects/standard/documents'
    const referenceSchema = buildSchema(workspace.readFixture(`diagnostics/${schemaFile}`))

    return {
        referenceErrors: (file: string): ReadonlyArray<string> => validate(
            referenceSchema,
            parse(workspace.readFixture(`diagnostics/${documentsRoot}/${file}`))
        ).map(error => error.message),
        generate: (file: string, typename?: SchemaConfig['typename']) => generateFixtureProject({
            root: resolve(workspace.root, 'diagnostics'),
            projectId: 'standard',
            schema: {
                file: schemaFile,
                typesModule: '@app/graphql/schema',
                scalars: { JSON: defineUnknown() },
                typename,
            },
            documentsRoot,
            documents: { files: [file] },
        }),
    }
}
