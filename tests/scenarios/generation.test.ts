import {
    afterAll,
    describe,
    expect,
    test,
} from 'vitest'

import {
    defineConfig,
    defineNamed,
    defineString,
    generateDeclarations,
} from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { generateFixtureProject } from '../fixtures/generation'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root
const readFixture = fixtureWorkspace.readFixture

afterAll(fixtureWorkspace.dispose)


describe('experimental generation public API', () => {
    test('generates a complete single-schema project through the filesystem API', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'single-schema-project'),
            resolve: {
                alias: {
                    'projects/app/documents': '~tests/fixtures/documents',
                },
            },
            schemas: {
                main: {
                    file: 'schemas/main/schema.graphql',
                    typesModule: '@case/schema',
                    enumsModule: '@case/enums',
                    scalars: { DateTime: defineString() },
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        main: {
                            schema: 'main',
                            documents: { glob: { include: ['**/*.graphql'] } },
                            outputs: { tree: { root: 'generated/app' } },
                        },
                    },
                },
            },
        }))
        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toMatchObject([
            { sourceId: 'fragments/GroupDetails.graphql', file: 'generated/app/fragments/GroupDetails.graphql.d.ts' },
            { sourceId: 'fragments/UserDetails.graphql', file: 'generated/app/fragments/UserDetails.graphql.d.ts' },
            { sourceId: 'fragments/UserWithGroups.graphql', file: 'generated/app/fragments/UserWithGroups.graphql.d.ts' },
            { sourceId: 'mutations/addGroup.graphql', file: 'generated/app/mutations/addGroup.graphql.d.ts' },
            { sourceId: 'mutations/changeOwner.graphql', file: 'generated/app/mutations/changeOwner.graphql.d.ts' },
            { sourceId: 'mutations/createUser.graphql', file: 'generated/app/mutations/createUser.graphql.d.ts' },
            { sourceId: 'mutations/removeGroup.graphql', file: 'generated/app/mutations/removeGroup.graphql.d.ts' },
            { sourceId: 'queries/groupMembers.graphql', file: 'generated/app/queries/groupMembers.graphql.d.ts' },
            { sourceId: 'queries/ownerGroup.graphql', file: 'generated/app/queries/ownerGroup.graphql.d.ts' },
            { sourceId: 'queries/user.graphql', file: 'generated/app/queries/user.graphql.d.ts' },
            { sourceId: 'queries/userGroups.graphql', file: 'generated/app/queries/userGroups.graphql.d.ts' },
            { sourceId: 'queries/users.graphql', file: 'generated/app/queries/users.graphql.d.ts' },
            { sourceId: 'subscriptions/ownerGroupChanged.graphql', file: 'generated/app/subscriptions/ownerGroupChanged.graphql.d.ts' },
            { sourceId: 'subscriptions/userCreated.graphql', file: 'generated/app/subscriptions/userCreated.graphql.d.ts' },
        ])

        for (const output of result.outputs) {
            expect(output.content).toBe(readFixture(
                `single-schema-project/expected/app/${output.sourceId}.d.ts`
            ))
        }
    })

    test('isolates multiple schema targets inside one project', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'multi-schema-project'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/core/schema',
                },
                analytics: {
                    file: 'schemas/analytics/schema.graphql',
                    typesModule: '@app/graphql/analytics/schema',
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['core/dashboard.graphql'] },
                            outputs: { tree: { root: 'generated/app/core' } },
                        },
                        analytics: {
                            schema: 'analytics',
                            documents: { files: ['analytics/dashboard.graphql'] },
                            outputs: { tree: { root: 'generated/app/analytics' } },
                        },
                    },
                },
            },
        }))

        expect(result).toEqual({
            outputs: [
                {
                    kind: 'document-declaration',
                    projectId: 'app',
                    targetId: 'analytics',
                    schemaId: 'analytics',
                    sourceId: 'analytics/dashboard.graphql',
                    file: 'generated/app/analytics/analytics/dashboard.graphql.d.ts',
                    content: readFixture(
                        'multi-schema-project/expected/app/analytics/dashboard.graphql.d.ts'
                    ),
                },
                {
                    kind: 'document-declaration',
                    projectId: 'app',
                    targetId: 'core',
                    schemaId: 'core',
                    sourceId: 'core/dashboard.graphql',
                    file: 'generated/app/core/core/dashboard.graphql.d.ts',
                    content: readFixture(
                        'multi-schema-project/expected/app/core/dashboard.graphql.d.ts'
                    ),
                },
            ],
            diagnostics: [],
        })
    })

    test('reuses one schema across isolated targets', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'naming-boundaries'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        primary: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'generated/primary' } },
                        },
                        secondary: {
                            schema: 'core',
                            documents: { files: ['queries/status.graphql'] },
                            outputs: { tree: { root: 'generated/secondary' } },
                        },
                    },
                },
            },
        }))

        expect(result.outputs).toHaveLength(2)
        expect(result.outputs[0]).toMatchObject({
            targetId: 'primary',
            schemaId: 'core',
            file: 'generated/primary/queries/users.graphql.d.ts',
        })
        expect(result.outputs[1]).toMatchObject({
            targetId: 'secondary',
            schemaId: 'core',
            file: 'generated/secondary/queries/status.graphql.d.ts',
        })
    })

    test('generates several projects in one call', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'multiple-schemas'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                },
                analytics: {
                    file: 'schemas/analytics/schema.graphql',
                    typesModule: '@app/graphql/schema',
                },
            },
            projects: {
                'core-app': {
                    root: 'projects/core-app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/dashboard.graphql'] },
                            outputs: { tree: { root: 'generated/core-app' } },
                        },
                    },
                },
                'analytics-app': {
                    root: 'projects/analytics-app/documents',
                    targets: {
                        analytics: {
                            schema: 'analytics',
                            documents: { files: ['queries/dashboard.graphql'] },
                            outputs: { tree: { root: 'generated/analytics-app' } },
                        },
                    },
                },
            },
        }))

        expect(result).toEqual({
            outputs: [
                {
                    kind: 'document-declaration',
                    projectId: 'analytics-app',
                    targetId: 'analytics',
                    schemaId: 'analytics',
                    sourceId: 'queries/dashboard.graphql',
                    file: 'generated/analytics-app/queries/dashboard.graphql.d.ts',
                    content: readFixture('multiple-schemas/expected/analytics-app/types.d.ts'),
                },
                {
                    kind: 'document-declaration',
                    projectId: 'core-app',
                    targetId: 'core',
                    schemaId: 'core',
                    sourceId: 'queries/dashboard.graphql',
                    file: 'generated/core-app/queries/dashboard.graphql.d.ts',
                    content: readFixture('multiple-schemas/expected/core-app/types.d.ts'),
                },
            ],
            diagnostics: [],
        })
    })

    test('emits a schema contract and aggregate beside the declaration tree', async () => {
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/search.graphql'] },
                            outputs: {
                                tree: { root: 'generated/operations' },
                                aggregate: { file: 'all.d.ts' },
                            },
                        },
                    },
                },
            },
        }))
        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toMatchObject([
            { kind: 'schema-types', schemaId: 'core', file: 'generated/schema/schema.d.ts' },
            { kind: 'schema-enums', schemaId: 'core', file: 'generated/schema/enums.ts' },
            {
                kind: 'document-declaration',
                projectId: 'app',
                targetId: 'core',
                schemaId: 'core',
                sourceId: 'queries/search.graphql',
                file: 'generated/operations/queries/search.graphql.d.ts',
            },
            {
                kind: 'aggregate-declaration',
                projectId: 'app',
                targetId: 'core',
                schemaId: 'core',
                file: 'generated/operations/all.d.ts',
            },
        ])
        expect(result.outputs[0]?.content).toBe(readFixture(
            'schema-contract/expected/schema.d.ts'
        ))
        expect(result.outputs[1]?.content).toBe(readFixture(
            'schema-contract/expected/enums.ts'
        ))
        expect(result.outputs[2]?.content).toBe(readFixture(
            'schema-contract/expected/operations.d.ts'
        ))
        expect(result.outputs[3]?.content).toBe(readFixture(
            'schema-contract/expected/aggregate.d.ts'
        ))
        expect(readFileSync(resolve(root, 'generated/schema/schema.d.ts'), 'utf8')).toBe(
            result.outputs[0]?.content
        )
        expect(readFileSync(resolve(root, 'generated/schema/enums.ts'), 'utf8')).toBe(
            result.outputs[1]?.content
        )
        expect(readFileSync(
            resolve(root, 'generated/operations/queries/search.graphql.d.ts'),
            'utf8'
        )).toBe(result.outputs[2]?.content)
        expect(readFileSync(resolve(root, 'generated/operations/all.d.ts'), 'utf8')).toBe(
            result.outputs[3]?.content
        )
    })

    test('rejects schema declaration names that collide after normalization', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'name-collisions'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/schema-collision',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))).rejects.toThrow(
            'Generated schema declaration name "UserProfile" is used by both type "UserProfile" and type "user_profile"'
        )
    })

    test('rejects schema type names that collide with generated helpers', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'name-collisions'),
            schemas: {
                core: {
                    file: 'schemas/helper.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/helper-collision',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))).rejects.toThrow(
            'Generated schema declaration name "Exact" is used by both helper "Exact" and type "Exact"'
        )
    })

    test('rejects schema types that collide with generated argument declarations', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'name-collisions'),
            schemas: {
                core: {
                    file: 'schemas/arguments.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/argument-collision',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))).rejects.toThrow(
            'Generated schema declaration name "QueryUserArgs" is used by both arguments for "Query.user" and type "QueryUserArgs"'
        )
    })

    test('inlines enums and unknown custom scalars when modules and mappings are absent', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'scalar-mappings'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/schema',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))

        expect(result.outputs).toMatchObject([{
            kind: 'schema-types',
            schemaId: 'core',
            file: 'generated/schema/schema.d.ts',
        }])
        expect(result.outputs[0]?.content).toContain('constructor: { input: unknown; output: unknown; };')
        expect(result.outputs[0]?.content).not.toContain('export enum')
    })

    test('inlines schema enums when no enum module is configured', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/inline-schema',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))

        expect(result.outputs).toMatchObject([{
            kind: 'schema-types',
            schemaId: 'core',
            file: 'generated/inline-schema/schema.d.ts',
        }])
        expect(result.outputs[0]?.content).toContain('export enum UserStatus')
        expect(result.outputs[0]?.content).not.toContain('import type')
    })

    test('generates isolated declarations for the core app project', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'multiple-schemas'),
            projectId: 'core-app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/core-app/documents',
            documents: { files: ['queries/dashboard.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'core-app',
            outputs: [{
                sourceId: 'queries/dashboard.graphql',
                content: readFixture('multiple-schemas/expected/core-app/types.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('generates isolated declarations for the analytics app project', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'multiple-schemas'),
            projectId: 'analytics-app',
            schema: {
                file: 'schemas/analytics/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/analytics-app/documents',
            documents: { files: ['queries/dashboard.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'analytics-app',
            outputs: [{
                sourceId: 'queries/dashboard.graphql',
                content: readFixture('multiple-schemas/expected/analytics-app/types.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('generates variables bound to field arguments', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'shared-schema'),
            projectId: 'shell',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/shell/documents',
            documents: { files: ['queries/customer.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'shell',
            outputs: [{
                sourceId: 'queries/customer.graphql',
                content: readFixture('shared-schema/expected/shell/types.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('reports unsupported schema types without emitting a partial declaration', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'shared-schema'),
            projectId: 'customer-sdk',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/customer-sdk/documents',
            documents: { files: ['queries/customer.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'customer-sdk',
            outputs: [],
            diagnostics: [{
                severity: 'error',
                code: 'unsupported-schema-type',
                sourceId: 'queries/customer.graphql',
                message: 'Scalar "DateTime" is not supported yet',
            }],
        })
    })

    test('does not confuse a prototype property with a built-in scalar', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'scalar-mappings'),
            projectId: 'prototype-scalar',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/value.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'prototype-scalar',
            outputs: [],
            diagnostics: [{
                severity: 'error',
                code: 'unsupported-schema-type',
                sourceId: 'queries/value.graphql',
                message: 'Scalar "constructor" is not supported yet',
            }],
        })
    })

    test('generates fragment modules and multiple operations through one project call', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'fragment-heavy'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: {
                files: [
                    'fragments/NodeFields.graphql',
                    'fragments/UserIdentity.graphql',
                    'fragments/GroupDetails.graphql',
                    'fragments/UserGroups.graphql',
                    'queries/groups.graphql',
                    'queries/users.graphql',
                    'mixed/dashboard.graphql',
                ],
            },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [
                {
                    sourceId: 'fragments/GroupDetails.graphql',
                    content: readFixture('fragment-heavy/expected/app/fragments/GroupDetails.graphql.d.ts'),
                },
                {
                    sourceId: 'fragments/NodeFields.graphql',
                    content: readFixture('fragment-heavy/expected/app/fragments/NodeFields.graphql.d.ts'),
                },
                {
                    sourceId: 'fragments/UserGroups.graphql',
                    content: readFixture('fragment-heavy/expected/app/fragments/UserGroups.graphql.d.ts'),
                },
                {
                    sourceId: 'fragments/UserIdentity.graphql',
                    content: readFixture('fragment-heavy/expected/app/fragments/UserIdentity.graphql.d.ts'),
                },
                {
                    sourceId: 'mixed/dashboard.graphql',
                    content: readFixture('fragment-heavy/expected/app/mixed/dashboard.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/groups.graphql',
                    content: readFixture('fragment-heavy/expected/app/queries/groups.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/users.graphql',
                    content: readFixture('fragment-heavy/expected/app/queries/users.graphql.d.ts'),
                },
            ],
            diagnostics: [],
        })
    })

    test('uses operation variables inside a named fragment', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'fragment-variables'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: {
                files: [
                    'fragments/User.graphql',
                    'queries/user.graphql',
                ],
            },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [
                {
                    sourceId: 'fragments/User.graphql',
                    content: readFixture('fragment-variables/expected/app/fragments/User.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/user.graphql',
                    content: readFixture('fragment-variables/expected/app/queries/user.graphql.d.ts'),
                },
            ],
            diagnostics: [],
        })
    })

    test('allows an operation and a fragment to have the same GraphQL name', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'fragment-variables'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['same-name.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'same-name.graphql',
                content: readFixture('fragment-variables/expected/app/same-name.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('resolves same-named fragments by explicit provider and local document ownership', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'fragment-providers'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: {
                files: [
                    'fragments/group.graphql',
                    'fragments/user.graphql',
                    'mixed/local.graphql',
                    'queries/group.graphql',
                    'queries/user.graphql',
                ],
            },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [
                {
                    sourceId: 'fragments/group.graphql',
                    content: readFixture('fragment-providers/expected/app/fragments/group.graphql.d.ts'),
                },
                {
                    sourceId: 'fragments/user.graphql',
                    content: readFixture('fragment-providers/expected/app/fragments/user.graphql.d.ts'),
                },
                {
                    sourceId: 'mixed/local.graphql',
                    content: readFixture('fragment-providers/expected/app/mixed/local.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/group.graphql',
                    content: readFixture('fragment-providers/expected/app/queries/group.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/user.graphql',
                    content: readFixture('fragment-providers/expected/app/queries/user.graphql.d.ts'),
                },
            ],
            diagnostics: [],
        })
    })

    test('applies independent naming styles to generated declarations', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'custom-naming'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@naming/schema',
                enumsModule: '@naming/enums',
                naming: {
                    typeNames: 'snakeCase',
                    operationNames: 'keep',
                    fragmentNames: 'camelCase',
                },
            },
            documentsRoot: 'projects/app/documents',
            documents: {
                files: [
                    'fragments/user_fields.graphql',
                    'queries/fetch_users.graphql',
                ],
            },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [
                {
                    sourceId: 'fragments/user_fields.graphql',
                    content: readFixture('custom-naming/expected/app/fragments/user_fields.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/fetch_users.graphql',
                    content: readFixture('custom-naming/expected/app/queries/fetch_users.graphql.d.ts'),
                },
            ],
            diagnostics: [],
        })
    })

    test('merges compatible repeated fields and their nested selections', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'repeated-selections'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/user.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [{
                sourceId: 'queries/user.graphql',
                content: readFixture('repeated-selections/expected/app/queries/user.graphql.d.ts'),
            }],
            diagnostics: [
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/user.graphql',
                    message: 'Repeated field selection "__typename" in query "User" was merged; first occurrence is at 2:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/user.graphql',
                    message: 'Repeated field selection "maybeType" in query "User" was merged; first occurrence is at 4:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/user.graphql',
                    message: 'Repeated field selection "user" in query "User" was merged; first occurrence is at 6:5',
                },
                {
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId: 'queries/user.graphql',
                    message: 'Repeated field selection "user" in query "User" was merged; first occurrence is at 6:5',
                },
            ],
        })
    })

    test('plans concrete variants and composes repeated selections across fragments', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'selection-composition'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/app/documents',
            documents: {
                files: [
                    'fragments/NodeIdentity.graphql',
                    'fragments/UserDetails.graphql',
                    'queries/viewer.graphql',
                ],
            },
        })

        expect(result).toEqual({
            projectId: 'app',
            outputs: [
                {
                    sourceId: 'fragments/NodeIdentity.graphql',
                    content: readFixture('selection-composition/expected/app/fragments/NodeIdentity.graphql.d.ts'),
                },
                {
                    sourceId: 'fragments/UserDetails.graphql',
                    content: readFixture('selection-composition/expected/app/fragments/UserDetails.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/viewer.graphql',
                    content: readFixture('selection-composition/expected/app/queries/viewer.graphql.d.ts'),
                },
            ],
            diagnostics: [{
                severity: 'warning',
                code: 'repeated-fragment-spread',
                sourceId: 'queries/viewer.graphql',
                message: 'Repeated fragment spread "NodeIdentity" in query "Viewer" was merged; first occurrence is at 7:9',
            }],
        })
    })

    test('applies a naming style shorthand to every generated name category', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'naming-boundaries'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@naming/schema',
                naming: 'snakeCase',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/users.graphql'] },
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs[0]?.content).toContain(
            'export type fetch_http2_users_query_variables = { [key: string]: never }'
        )
        expect(result.outputs[0]?.content).toContain(
            'export const fetch_http2_users_query: TypedDocumentNode<fetch_http2_users_query_payload, fetch_http2_users_query_variables>'
        )
    })

    test('keeps schema type names when requested', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'naming-boundaries'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@naming/schema',
                naming: 'keep',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/status.graphql'] },
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs[0]?.content).toContain(
            'import type { user_status } from \'@naming/schema\''
        )
        expect(result.outputs[0]?.content).toContain('status: user_status;')
    })

    test.each([
        [ 'snakeCase' as const, '____query' ],
        [ 'camelCase' as const, '___Query' ],
    ])('preserves an underscore-only operation name with %s naming', async (naming, exportName) => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'naming-boundaries'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@naming/schema',
                naming,
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/underscores.graphql'] },
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs[0]?.content).toContain(`export const ${exportName}:`)
    })

    test('generates abstract selections and nested input types', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'abstract-selections'),
            projectId: 'search-ui',
            schema: {
                file: 'schemas/search/schema.graphql',
                typesModule: '@search/graphql/schema',
                enumsModule: '@search/graphql/enums',
                scalars: {
                    DateTime: defineString(),
                },
                directives: {
                    includeArchived: { effect: 'conditional' },
                },
            },
            documentsRoot: 'projects/search-ui/documents',
            documents: {
                files: [
                    'queries/search.graphql',
                    'queries/node.graphql',
                ],
            },
        })

        expect(result).toEqual({
            projectId: 'search-ui',
            outputs: [
                {
                    sourceId: 'queries/node.graphql',
                    content: readFixture('abstract-selections/expected/search-ui/queries/node.graphql.d.ts'),
                },
                {
                    sourceId: 'queries/search.graphql',
                    content: readFixture('abstract-selections/expected/search-ui/queries/search.graphql.d.ts'),
                },
            ],
            diagnostics: [],
        })
    })

    test('applies override, nonnull and warning directive policies without blocking output', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'diagnostics'),
            projectId: 'directives',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
                scalars: { Date: defineString() },
                directives: {
                    opaque: { effect: 'override', type: defineNamed('OpaqueDate') },
                    required: { effect: 'nonnull' },
                    review: {
                        field: {
                            effect: 'warn',
                            message: 'Review the selected identifier',
                        },
                        fragmentSpread: { effect: 'conditional' },
                        inlineFragment: { effect: 'warn' },
                    },
                },
            },
            documentsRoot: 'projects/directives/documents',
            documents: { files: ['directives.graphql'] },
        })

        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).toContain('date: OpaqueDate;')
        expect(result.outputs[0]?.content).toContain(
            'user: {\n\t\t__typename?: \'User\';\n\t\tid: string;\n\t\tstatus: Status;\n\t};'
        )
        expect(result.diagnostics).toEqual([
            {
                severity: 'warning',
                code: 'directive-warning',
                sourceId: 'directives.graphql',
                message: 'Review the selected identifier',
            },
            {
                severity: 'warning',
                code: 'directive-warning',
                sourceId: 'directives.graphql',
                message: 'Directive "@review" requires manual review',
            },
        ])
    })

    test('normalizes acronym runs and avoids duplicate operation suffixes', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'naming-boundaries'),
            projectId: 'app',
            schema: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@naming/schema',
                naming: 'pascalCase',
            },
            documentsRoot: 'projects/app/documents',
            documents: { files: ['queries/users.graphql', 'queries/bots-query.graphql'] },
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs[0]?.content).toContain('export type FetchMgBotsQueryVariables')
        expect(result.outputs[0]?.content).toContain('export const fetchMgBotsQuery:')
        expect(result.outputs[0]?.content).not.toContain('QueryQuery')
        expect(result.outputs[1]?.content).toContain('export type FetchHttp2UsersQueryVariables')
    })

    test('generates declarations for nested literal field and directive arguments', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'literal-arguments'),
            projectId: 'search-ui',
            schema: {
                file: 'schemas/search/schema.graphql',
                typesModule: '@search/graphql/schema',
            },
            documentsRoot: 'projects/search-ui/documents',
            documents: { files: ['queries/search.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'search-ui',
            outputs: [{
                sourceId: 'queries/search.graphql',
                content: readFixture('literal-arguments/expected/search-ui/queries/search.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })

    test('generates declarations for complete input value semantics', async () => {
        const result = await generateFixtureProject({
            root: resolve(fixturesRoot, 'input-values'),
            projectId: 'search-ui',
            schema: {
                file: 'schemas/search/schema.graphql',
                typesModule: '@search/graphql/schema',
                enumsModule: '@search/graphql/enums',
            },
            documentsRoot: 'projects/search-ui/documents',
            documents: { files: ['queries/search.graphql'] },
        })

        expect(result).toEqual({
            projectId: 'search-ui',
            outputs: [{
                sourceId: 'queries/search.graphql',
                content: readFixture('input-values/expected/search-ui/queries/search.graphql.d.ts'),
            }],
            diagnostics: [],
        })
    })
})
