import {
    afterAll,
    describe,
    expect,
    test,
} from 'vitest'

import {
    defineConfig,
    defineString,
    generateDeclarations,
} from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import {
    readFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const root = resolve(fixtureWorkspace.root, 'single-schema-project')

afterAll(fixtureWorkspace.dispose)

describe('single-schema declaration contracts', () => {
    test('publishes schema, enum, tree, and aggregate declaration files', async () => {
        const result = await generateDeclarations(defineConfig({
            root,
            resolve: { alias: { 'projects/app/documents': '~tests/fixtures/documents' } },
            schemas: {
                main: {
                    file: 'schemas/main/schema.graphql',
                    typesModule: '@case/schema',
                    enumsModule: '@case/enums',
                    scalars: { DateTime: defineString() },
                    outputs: {
                        root: 'generated/schema',
                        types: 'schema.d.ts',
                        enums: 'enums.ts',
                    },
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        main: {
                            schema: 'main',
                            documents: { glob: { include: ['**/*.graphql'] } },
                            outputs: {
                                tree: { root: 'generated/operations' },
                                aggregate: { file: 'aggregate.d.ts' },
                            },
                        },
                    },
                },
            },
        }))

        expect(result.diagnostics).toEqual([])
        const schemaFiles = result.outputs.filter(output => (
            output.kind === 'schema-types' || output.kind === 'schema-enums'
        ))
        expect(schemaFiles.map(({ kind, file }) => ({ kind, file }))).toEqual([
            { kind: 'schema-types', file: 'generated/schema/schema.d.ts' },
            { kind: 'schema-enums', file: 'generated/schema/enums.ts' },
        ])
        for (const output of schemaFiles) {
            expect(readFileSync(resolve(root, output.file), 'utf8')).toBe(output.content)
        }

        const documents = result.outputs.filter(output => output.kind === 'document-declaration')
        const aggregate = result.outputs.find(output => output.kind === 'aggregate-declaration')
        expect(documents).toHaveLength(14)
        expect(aggregate?.file).toBe('generated/operations/aggregate.d.ts')
        expect(readFileSync(resolve(root, 'generated/operations/aggregate.d.ts'), 'utf8')).toBe(
            readFileSync(resolve(__dirname, '../fixtures/cases/single-schema-project/expected/aggregate.d.ts'), 'utf8')
        )
    })
})
