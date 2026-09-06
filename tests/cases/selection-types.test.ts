import { afterAll, describe, expect, test } from 'vitest'

import { defineConfig, defineString, generateDeclarations } from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { generateFixtureProject } from '../fixtures/generation'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root
const readFixture = fixtureWorkspace.readFixture

afterAll(fixtureWorkspace.dispose)

describe('generated selection type contracts', () => {
    test('emits declarations consumable by TypeScript', async () => {
        const root = resolve(fixturesRoot, 'schema-contract')
        const result = await generateDeclarations(defineConfig({
            root,
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    enumsModule: '@app/graphql/enums',
                    scalars: {
                        DateTime: defineString(),
                    },
                    outputs: {
                        root: 'generated/type-consumption/schema',
                        types: 'schema.d.ts',
                        enums: 'enums.ts',
                    },
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/search.graphql'] },
                            outputs: {
                                tree: { root: 'generated/type-consumption/operations' },
                            },
                        },
                    },
                },
            },
        }))

        expect(result.diagnostics).toEqual([])
    })

    test('keeps nested fields optional when their fragment spread is conditional', async () => {
        const root = resolve(fixturesRoot, 'conditional-fragment')
        const result = await generateFixtureProject({
            root,
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['viewer.graphql'] },
        })
        expect(result.outputs[0]?.content).not.toContain('Partial<Details>')
        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'viewer.graphql',
                content: readFixture('conditional-fragment/expected/app/viewer.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('merges an unconditional base fragment with a conditional fragment', async () => {
        const root = resolve(fixturesRoot, 'conditional-fragment')
        const result = await generateFixtureProject({
            root,
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['composed.graphql'] },
        })
        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'composed.graphql',
                content: readFixture('conditional-fragment/expected/app/composed.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('merges a transitive base fragment with a conditional fragment', async () => {
        const root = resolve(fixturesRoot, 'conditional-fragment')
        const result = await generateFixtureProject({
            root,
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['transitive.graphql'] },
        })
        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'transitive.graphql',
                content: readFixture('conditional-fragment/expected/app/transitive.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('keeps every concrete variant of a conditional abstract fragment', async () => {
        const root = resolve(fixturesRoot, 'conditional-fragment')
        const result = await generateFixtureProject({
            root,
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['abstract.graphql'] },
        })
        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'abstract.graphql',
                content: readFixture('conditional-fragment/expected/app/abstract.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('narrows abstract fragments to the concrete field type', async () => {
        const root = resolve(fixturesRoot, 'abstract-fragment-narrowing')
        const result = await generateFixtureProject({
            root,
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['only-a.graphql'] },
        })
        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'only-a.graphql',
                content: readFixture('abstract-fragment-narrowing/expected/app/only-a.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('keeps selected fields when repeated objects also contain statically skipped fields', async () => {
        const root = resolve(fixturesRoot, 'repeated-selections')
        const result = await generateFixtureProject({
            root,
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/skipped.graphql'] },
        })
        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'queries/skipped.graphql',
                content: readFixture('repeated-selections/expected/app/queries/skipped.graphql.d.ts'),
            }],
            diagnostics: [
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/skipped.graphql',
                    message: 'Repeated field selection "user" in query "SkippedFirst" was merged; first occurrence is at 2:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/skipped.graphql',
                    message: 'Repeated field selection "user" in query "SelectedFirst" was merged; first occurrence is at 11:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/skipped.graphql',
                    message: 'Repeated field selection "user" in query "BothSkipped" was merged; first occurrence is at 20:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/skipped.graphql',
                    message: 'Repeated field selection "user" in query "NestedSkippedFirst" was merged; first occurrence is at 29:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/skipped.graphql',
                    message: 'Repeated field selection "user" in query "NestedSelectedFirst" was merged; first occurrence is at 42:5',
                },
            ],
        })
    })
})
