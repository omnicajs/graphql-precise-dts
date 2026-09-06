import {
    afterAll,
    describe,
    expect,
    test,
} from 'vitest'

import type {
    DocumentSelector,
    SchemaConfig,
} from '@/index'
import {
    checkDeclarations,
    defineConfig,
    defineString,
    generateDeclarations,
} from '@/index'
import { createFixtureWorkspace } from '../fixture-workspace'
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root
const readFixture = fixtureWorkspace.readFixture

afterAll(fixtureWorkspace.dispose)

const generateFixtureProject = async ({
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

describe('experimental filesystem public API', () => {
    test('publishes a declaration tree with a deterministic ownership manifest', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const result = await generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/app' } },
                        },
                    },
                },
            },
        }))

        expect(readFileSync(
            resolve(root, 'published/app/queries/users.graphql.d.ts'),
            'utf8'
        )).toBe(result.outputs[0]?.content)
        expect(JSON.parse(readFileSync(
            resolve(root, 'published/app/.graphql-precise-dts-manifest.json'),
            'utf8'
        ))).toEqual({
            formatVersion: 1,
            files: [{
                path: 'queries/users.graphql.d.ts',
                kind: 'document-declaration',
                contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
            }],
        })
    })

    test('preserves timestamps when declarations and manifests are unchanged', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const config = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/unchanged' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(config)
        const outputFile = resolve(
            root,
            'published/unchanged/queries/users.graphql.d.ts'
        )
        const manifestFile = resolve(
            root,
            'published/unchanged/.graphql-precise-dts-manifest.json'
        )
        const fixedTimestamp = new Date('2001-02-03T04:05:06.000Z')
        utimesSync(outputFile, fixedTimestamp, fixedTimestamp)
        utimesSync(manifestFile, fixedTimestamp, fixedTimestamp)

        await generateDeclarations(config)

        expect(statSync(outputFile).mtimeMs).toBe(fixedTimestamp.getTime())
        expect(statSync(manifestFile).mtimeMs).toBe(fixedTimestamp.getTime())
    })

    test('removes a disabled aggregate from its target declaration tree', async () => {
        const root = resolve(fixturesRoot, 'publication')
        await generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: {
                                tree: { root: 'published/aggregate-cleanup' },
                                aggregate: { file: 'all.d.ts' },
                            },
                        },
                    },
                },
            },
        }))
        const aggregateFile = resolve(
            root,
            'published/aggregate-cleanup/all.d.ts'
        )
        expect(existsSync(aggregateFile)).toBe(true)

        await generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/aggregate-cleanup' } },
                        },
                    },
                },
            },
        }))

        expect(existsSync(aggregateFile)).toBe(false)
        expect(JSON.parse(readFileSync(
            resolve(
                root,
                'published/aggregate-cleanup/.graphql-precise-dts-manifest.json'
            ),
            'utf8'
        )).files).toMatchObject([{
            kind: 'document-declaration',
            path: 'queries/users.graphql.d.ts',
        }])
    })

    test('removes only stale files owned by the previous successful publication', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const firstConfig = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: {
                                files: [
                                    'queries/status.graphql',
                                    'queries/underscores.graphql',
                                    'queries/users.graphql',
                                ],
                            },
                            outputs: { tree: { root: 'published/stale' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(firstConfig)
        writeFileSync(resolve(root, 'published/stale/foreign.txt'), 'keep')
        rmSync(resolve(
            root,
            'published/stale/queries/underscores.graphql.d.ts'
        ))

        await generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/stale' } },
                        },
                    },
                },
            },
        }))

        expect(existsSync(resolve(
            root,
            'published/stale/queries/status.graphql.d.ts'
        ))).toBe(false)
        expect(existsSync(resolve(
            root,
            'published/stale/queries/users.graphql.d.ts'
        ))).toBe(true)
        expect(readFileSync(resolve(root, 'published/stale/foreign.txt'), 'utf8')).toBe('keep')
        expect(JSON.parse(readFileSync(
            resolve(root, 'published/stale/.graphql-precise-dts-manifest.json'),
            'utf8'
        )).files).toMatchObject([{ path: 'queries/users.graphql.d.ts' }])
    })

    test('rejects cleanup of a stale declaration modified after publication', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const firstConfig = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: {
                                files: [
                                    'queries/status.graphql',
                                    'queries/users.graphql',
                                ],
                            },
                            outputs: { tree: { root: 'published/modified' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(firstConfig)
        const statusOutput = resolve(
            root,
            'published/modified/queries/status.graphql.d.ts'
        )
        const usersOutput = resolve(
            root,
            'published/modified/queries/users.graphql.d.ts'
        )
        const manifestFile = resolve(
            root,
            'published/modified/.graphql-precise-dts-manifest.json'
        )
        const usersContent = readFileSync(usersOutput, 'utf8')
        const manifest = readFileSync(manifestFile, 'utf8')
        writeFileSync(statusOutput, 'manually changed')

        await expect(generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/modified' } },
                        },
                    },
                },
            },
        }))).rejects.toThrow(`Output file "${statusOutput}" was modified after publication`)
        expect(readFileSync(statusOutput, 'utf8')).toBe('manually changed')
        expect(readFileSync(usersOutput, 'utf8')).toBe(usersContent)
        expect(readFileSync(manifestFile, 'utf8')).toBe(manifest)
    })

    test('does not overwrite a declaration file without an ownership manifest', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const outputFile = resolve(
            root,
            'published/unowned/queries/users.graphql.d.ts'
        )
        mkdirSync(resolve(root, 'published/unowned/queries'), { recursive: true })
        writeFileSync(outputFile, 'foreign declaration')

        await expect(generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/unowned' } },
                        },
                    },
                },
            },
        }))).rejects.toThrow(`Output file "${outputFile}" is not owned by the declaration tree`)
        expect(readFileSync(outputFile, 'utf8')).toBe('foreign declaration')
        expect(existsSync(resolve(
            root,
            'published/unowned/.graphql-precise-dts-manifest.json'
        ))).toBe(false)
    })

    test('keeps the last successful declaration tree when compilation fails', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const documentFile = resolve(
            root,
            'projects/app/documents/queries/publication.graphql'
        )
        writeFileSync(documentFile, 'query Publication { users }')
        const config = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/publication.graphql'] },
                            outputs: { tree: { root: 'published/retained' } },
                        },
                    },
                },
            },
        })
        const successful = await generateDeclarations(config)
        const outputFile = resolve(
            root,
            'published/retained/queries/publication.graphql.d.ts'
        )
        const manifestFile = resolve(
            root,
            'published/retained/.graphql-precise-dts-manifest.json'
        )
        const publishedContent = readFileSync(outputFile, 'utf8')
        const publishedManifest = readFileSync(manifestFile, 'utf8')
        writeFileSync(documentFile, 'query Publication { missing }')

        const failed = await generateDeclarations(config)

        expect(successful.diagnostics).toEqual([])
        expect(failed.diagnostics).toMatchObject([{
            code: 'invalid-document',
            sourceId: 'queries/publication.graphql',
        }])
        expect(readFileSync(outputFile, 'utf8')).toBe(publishedContent)
        expect(readFileSync(manifestFile, 'utf8')).toBe(publishedManifest)
    })

    test('preflights every tree before changing any published file', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const firstDocument = resolve(
            root,
            'projects/app/documents/queries/transaction-a.graphql'
        )
        const secondDocument = resolve(
            root,
            'projects/app/documents/queries/transaction-b.graphql'
        )
        writeFileSync(firstDocument, 'query TransactionA { users }')
        writeFileSync(secondDocument, 'query TransactionB { status }')
        const config = defineConfig({
            root,
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
                        first: {
                            schema: 'core',
                            documents: { files: ['queries/transaction-a.graphql'] },
                            outputs: { tree: { root: 'published/transaction-a' } },
                        },
                        second: {
                            schema: 'core',
                            documents: { files: ['queries/transaction-b.graphql'] },
                            outputs: { tree: { root: 'published/transaction-b' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(config)
        const firstOutput = resolve(
            root,
            'published/transaction-a/queries/transaction-a.graphql.d.ts'
        )
        const secondOutput = resolve(
            root,
            'published/transaction-b/queries/transaction-b.graphql.d.ts'
        )
        const firstPublishedContent = readFileSync(firstOutput, 'utf8')
        writeFileSync(firstDocument, 'query TransactionA { renamed: users }')
        writeFileSync(secondOutput, 'manually changed')

        await expect(generateDeclarations(config)).rejects.toThrow(
            `Output file "${secondOutput}" was modified after publication`
        )
        expect(readFileSync(firstOutput, 'utf8')).toBe(firstPublishedContent)
        expect(readFileSync(secondOutput, 'utf8')).toBe('manually changed')
    })

    test('combines isolated targets that publish into the same declaration tree', async () => {
        const root = resolve(fixturesRoot, 'publication')
        await generateDeclarations(defineConfig({
            root,
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
                        status: {
                            schema: 'core',
                            documents: { files: ['queries/status.graphql'] },
                            outputs: { tree: { root: 'published/shared' } },
                        },
                        users: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'published/shared' } },
                        },
                    },
                },
            },
        }))

        expect(JSON.parse(readFileSync(
            resolve(root, 'published/shared/.graphql-precise-dts-manifest.json'),
            'utf8'
        )).files).toMatchObject([
            { path: 'queries/status.graphql.d.ts' },
            { path: 'queries/users.graphql.d.ts' },
        ])
    })

    test('publishes a declaration tree at the configuration root', async () => {
        const root = resolve(fixturesRoot, 'publication')
        await generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: '.' } },
                        },
                    },
                },
            },
        }))

        expect(existsSync(resolve(root, 'queries/users.graphql.d.ts'))).toBe(true)
        expect(existsSync(resolve(root, '.graphql-precise-dts-manifest.json'))).toBe(true)
    })

    test.each([
        [ 'invalid JSON', 'published/invalid-json', '{' ],
        [
            'unsupported version',
            'published/unsupported-version',
            JSON.stringify({ formatVersion: 2, files: [] }),
        ],
        [
            'invalid structure',
            'published/invalid-structure',
            JSON.stringify({ formatVersion: 1, files: 'invalid' }),
        ],
        [ 'invalid file kind', 'published/invalid-kind', JSON.stringify({
            formatVersion: 1,
            files: [{
                path: 'query.graphql.d.ts',
                kind: 'invalid',
                contentHash: 'sha256:existing',
            }],
        }) ],
        [ 'unsafe ownership path', 'published/unsafe-path', JSON.stringify({
            formatVersion: 1,
            files: [{
                path: '../foreign.d.ts',
                kind: 'document-declaration',
                contentHash: 'sha256:existing',
            }],
        }) ],
    ])('rejects an %s manifest before publishing files', async (_, outputRoot, manifest) => {
        const root = resolve(fixturesRoot, 'publication')
        mkdirSync(resolve(root, outputRoot), { recursive: true })
        writeFileSync(
            resolve(root, outputRoot, '.graphql-precise-dts-manifest.json'),
            manifest
        )

        await expect(generateDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: outputRoot } },
                        },
                    },
                },
            },
        }))).rejects.toThrow(/Output manifest/)
        expect(existsSync(resolve(
            root,
            outputRoot,
            'queries/users.graphql.d.ts'
        ))).toBe(false)
    })

    test('resolves a document module from the most specific filesystem alias', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
            resolve: {
                alias: {
                    projects: '@projects',
                    'projects/app/documents': '@documents/',
                    elsewhere: '@elsewhere',
                },
            },
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'generated/app' } },
                        },
                    },
                },
            },
        }))

        expect(result.outputs[0]).toMatchObject({
            sourceId: 'queries/users.graphql',
            file: 'generated/app/queries/users.graphql.d.ts',
        })
        expect(result.outputs[0]?.content).toContain(
            'declare module \'@documents/queries/users.graphql\''
        )
    })

    test('resolves an alias for an exact document file without a trailing slash', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
            resolve: {
                alias: {
                    'projects/app/documents/queries/users.graphql': '@documents/users.graphql',
                },
            },
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'generated/app' } },
                        },
                    },
                },
            },
        }))

        expect(result.outputs[0]?.content).toContain(
            'declare module \'@documents/users.graphql\''
        )
    })

    test('rejects aliases that resolve different documents to the same module ID', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
            resolve: {
                alias: {
                    'projects/app/documents/queries/status.graphql': '@documents/query.graphql',
                    'projects/app/documents/queries/users.graphql': '@documents/query.graphql',
                },
            },
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
                        core: {
                            schema: 'core',
                            documents: {
                                files: [
                                    'queries/status.graphql',
                                    'queries/users.graphql',
                                ],
                            },
                            outputs: { tree: { root: 'generated/app' } },
                        },
                    },
                },
            },
        }))).rejects.toThrow(
            'Module ID "@documents/query.graphql" is resolved from both '
            + '"queries/status.graphql" and "queries/users.graphql" in target "app/core"'
        )
    })

    test('rejects an output tree outside the configuration root', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: '../generated' } },
                        },
                    },
                },
            },
        }))).rejects.toThrow('Output root must be inside the configuration root')
    })

    test.each([
        [ '.', 'Output file must be inside its output root' ],
        [ '../aggregate.d.ts', 'Output file must be inside its output root' ],
    ])('rejects an aggregate output outside its publication tree: %s', async (file, message) => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: {
                                tree: { root: 'generated/app' },
                                aggregate: { file },
                            },
                        },
                    },
                },
            },
        }))).rejects.toThrow(message)
    })

    test.each([
        [ '.', 'Output file must be inside its output root' ],
        [ '../schema.d.ts', 'Output file must be inside its output root' ],
    ])('rejects a schema output outside its publication tree: %s', async (types, message) => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/schema',
                        types,
                    },
                },
            },
            projects: {},
        }))).rejects.toThrow(message)
    })

    test('rejects a document selected by two targets', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
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
                            outputs: { tree: { root: 'generated/shared' } },
                        },
                        secondary: {
                            schema: 'core',
                            documents: { regexp: /^queries\/users\.graphql$/ },
                            outputs: { tree: { root: 'generated/shared' } },
                        },
                    },
                },
            },
        }))).rejects.toThrow(
            /Document file ".+\/queries\/users\.graphql" is selected by both "app\/primary" and "app\/secondary"/
        )
    })

    test('rejects one output file produced from different physical documents', async () => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'publication'),
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'generated/shared' } },
                        },
                    },
                },
                other: {
                    root: 'projects/other/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'generated/shared' } },
                        },
                    },
                },
            },
        }))).rejects.toThrow(
            'Output file "generated/shared/queries/users.graphql.d.ts" '
            + 'is produced by both "app/core" and "other/core"'
        )
    })

    test('loads a schema file and an explicit list of document files', async () => {
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
                    content: readFixture(
                        'selection-composition/expected/app/fragments/NodeIdentity.graphql.d.ts'
                    ),
                },
                {
                    sourceId: 'fragments/UserDetails.graphql',
                    content: readFixture(
                        'selection-composition/expected/app/fragments/UserDetails.graphql.d.ts'
                    ),
                },
                {
                    sourceId: 'queries/viewer.graphql',
                    content: readFixture(
                        'selection-composition/expected/app/queries/viewer.graphql.d.ts'
                    ),
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

    test('discovers document files with include and exclude globs', async () => {
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
                glob: {
                    include: ['queries/*.graphql', 'queries/node.graphql'],
                    exclude: ['queries/search.graphql'],
                },
            },
        })

        expect(result).toEqual({
            projectId: 'search-ui',
            outputs: [{
                sourceId: 'queries/node.graphql',
                content: readFixture(
                    'abstract-selections/expected/search-ui/queries/node.graphql.d.ts'
                ),
            }],
            diagnostics: [],
        })
    })

    test('matches a regular expression against normalized project-relative paths', async () => {
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
            documents: { regexp: /^queries\/(?:node|search)\.graphql$/ },
        })

        expect(result).toEqual({
            projectId: 'search-ui',
            outputs: [
                {
                    sourceId: 'queries/node.graphql',
                    content: readFixture(
                        'abstract-selections/expected/search-ui/queries/node.graphql.d.ts'
                    ),
                },
                {
                    sourceId: 'queries/search.graphql',
                    content: readFixture(
                        'abstract-selections/expected/search-ui/queries/search.graphql.d.ts'
                    ),
                },
            ],
            diagnostics: [],
        })
    })

    test('rejects stateful regular expression selectors', async () => {
        await expect(generateFixtureProject({
            root: resolve(fixturesRoot, 'abstract-selections'),
            projectId: 'search-ui',
            schema: {
                file: 'schemas/search/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/search-ui/documents',
            documents: { regexp: /\.graphql$/g },
        })).rejects.toThrow('must not use the g or y flag')
    })

    test('rejects an explicit document file outside the project root', async () => {
        await expect(generateFixtureProject({
            root: resolve(fixturesRoot, 'abstract-selections'),
            projectId: 'search-ui',
            schema: {
                file: 'schemas/search/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
            documentsRoot: 'projects/search-ui/documents',
            documents: { files: ['../../../../schemas/search/schema.graphql'] },
        })).rejects.toThrow('Document file must be inside the project root')
    })

    test('rejects an invalid schema before rendering its contract', async () => {
        const root = resolve(fixturesRoot, 'publication')
        writeFileSync(resolve(root, 'schemas/invalid.graphql'), `
            interface First implements Second { id: ID! }
            interface Second implements First { id: ID! }
            type Query { node: First }
        `)

        await expect(generateDeclarations(defineConfig({
            root,
            schemas: {
                invalid: {
                    file: 'schemas/invalid.graphql',
                    typesModule: '@app/graphql/schema',
                    outputs: {
                        root: 'generated/invalid-schema',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))).rejects.toThrow('circular reference')
        expect(existsSync(resolve(root, 'generated/invalid-schema/schema.d.ts'))).toBe(false)
    })

    test('checks missing declarations without creating the output tree', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const result = await checkDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'checked/missing' } },
                        },
                    },
                },
            },
        }))

        expect(result.diagnostics).toEqual([])
        expect(result.differences).toEqual([
            { kind: 'missing', file: 'checked/missing/.graphql-precise-dts-manifest.json' },
            { kind: 'missing', file: 'checked/missing/queries/users.graphql.d.ts' },
        ])
        expect(existsSync(resolve(root, 'checked/missing'))).toBe(false)
    })

    test('checks an up-to-date tree without touching its timestamps', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const config = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'checked/current' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(config)
        const outputFile = resolve(root, 'checked/current/queries/users.graphql.d.ts')
        const manifestFile = resolve(root, 'checked/current/.graphql-precise-dts-manifest.json')
        const fixedTimestamp = new Date('2002-03-04T05:06:07.000Z')
        utimesSync(outputFile, fixedTimestamp, fixedTimestamp)
        utimesSync(manifestFile, fixedTimestamp, fixedTimestamp)

        const result = await checkDeclarations(config)

        expect(result.differences).toEqual([])
        expect(statSync(outputFile).mtimeMs).toBe(fixedTimestamp.getTime())
        expect(statSync(manifestFile).mtimeMs).toBe(fixedTimestamp.getTime())
    })

    test('reports a missing file from an otherwise current owned tree', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const config = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/status.graphql'] },
                            outputs: { tree: { root: 'checked/removed' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(config)
        rmSync(resolve(root, 'checked/removed/queries/status.graphql.d.ts'))

        expect((await checkDeclarations(config)).differences).toEqual([
            { kind: 'missing', file: 'checked/removed/queries/status.graphql.d.ts' },
        ])
    })

    test('reports declarations changed by source updates without overwriting them', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const config = defineConfig({
            root,
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    enumsModule: '@app/graphql/enums',
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'checked/changed' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(config)
        const outputFile = resolve(root, 'checked/changed/queries/users.graphql.d.ts')
        const originalOutput = readFileSync(outputFile, 'utf8')
        writeFileSync(
            resolve(root, 'projects/app/documents/queries/users.graphql'),
            'query FetchHTTP2Users { users status }\n'
        )

        const result = await checkDeclarations(config)

        expect(result.differences).toEqual([
            { kind: 'changed', file: 'checked/changed/.graphql-precise-dts-manifest.json' },
            { kind: 'changed', file: 'checked/changed/queries/users.graphql.d.ts' },
        ])
        expect(readFileSync(outputFile, 'utf8')).toBe(originalOutput)
    })

    test('reports stale declarations without deleting them', async () => {
        const root = resolve(fixturesRoot, 'publication')
        await generateDeclarations(defineConfig({
            root,
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    enumsModule: '@app/graphql/enums',
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: {
                                files: [
                                    'queries/status.graphql',
                                    'queries/users.graphql',
                                ],
                            },
                            outputs: { tree: { root: 'checked/stale' } },
                        },
                    },
                },
            },
        }))

        const result = await checkDeclarations(defineConfig({
            root,
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    enumsModule: '@app/graphql/enums',
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/users.graphql'] },
                            outputs: { tree: { root: 'checked/stale' } },
                        },
                    },
                },
            },
        }))

        expect(result.differences).toEqual([
            { kind: 'changed', file: 'checked/stale/.graphql-precise-dts-manifest.json' },
            { kind: 'stale', file: 'checked/stale/queries/status.graphql.d.ts' },
        ])
        expect(existsSync(resolve(root, 'checked/stale/queries/status.graphql.d.ts'))).toBe(true)
    })

    test('reports modified and unowned outputs without replacing them', async () => {
        const root = resolve(fixturesRoot, 'publication')
        const modifiedConfig = defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/status.graphql'] },
                            outputs: { tree: { root: 'checked/modified' } },
                        },
                    },
                },
            },
        })
        await generateDeclarations(modifiedConfig)
        const modifiedFile = resolve(root, 'checked/modified/queries/status.graphql.d.ts')
        writeFileSync(modifiedFile, 'consumer content\n')

        expect((await checkDeclarations(modifiedConfig)).differences).toEqual([
            { kind: 'modified', file: 'checked/modified/queries/status.graphql.d.ts' },
        ])
        expect(readFileSync(modifiedFile, 'utf8')).toBe('consumer content\n')

        const unownedFile = resolve(root, 'checked/unowned/queries/status.graphql.d.ts')
        mkdirSync(resolve(root, 'checked/unowned/queries'), { recursive: true })
        writeFileSync(unownedFile, 'consumer content\n')
        const unownedResult = await checkDeclarations(defineConfig({
            root,
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
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/status.graphql'] },
                            outputs: { tree: { root: 'checked/unowned' } },
                        },
                    },
                },
            },
        }))

        expect(unownedResult.differences).toEqual([
            { kind: 'missing', file: 'checked/unowned/.graphql-precise-dts-manifest.json' },
            { kind: 'unowned', file: 'checked/unowned/queries/status.graphql.d.ts' },
        ])
        expect(readFileSync(unownedFile, 'utf8')).toBe('consumer content\n')
    })
})
