import {
    afterAll,
    expect,
    test,
} from 'vitest'

import {
    type ExecutionConfig,
    checkDeclarations,
    defineConfig,
    generateDeclarations,
} from '@/index'
import { createFixtureWorkspace } from '../fixture-workspace'
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root

afterAll(fixtureWorkspace.dispose)

const makeConfig = (
    outputRoot: string,
    cacheDirectory: string,
    execution: ExecutionConfig
) => {
    const common = {
        root: resolve(fixturesRoot, 'selection-composition'),
        cache: { directory: cacheDirectory },
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
                        documents: { glob: { include: ['**/*.graphql'] } },
                        outputs: {
                            tree: { root: outputRoot },
                            aggregate: { file: 'all.d.ts' },
                        },
                    },
                },
            },
        },
    } as const

    return execution.mode === 'parallel'
        ? defineConfig({ ...common, execution })
        : defineConfig({ ...common, execution })
}

test('keeps cold and warm parallel generation equivalent to sequential generation', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const outputRoot = 'generated/execution-equivalence'
    const sequential = await generateDeclarations(makeConfig(
        outputRoot,
        '.cache/sequential',
        { mode: 'sequential' }
    ))
    const sequentialManifest = readFileSync(resolve(
        root,
        outputRoot,
        '.graphql-precise-dts-manifest.json'
    ), 'utf8')

    rmSync(resolve(root, outputRoot), { recursive: true })

    const parallelConfig = makeConfig(
        outputRoot,
        '.cache/parallel',
        { mode: 'parallel', maxWorkers: 2 }
    )
    const coldParallel = await generateDeclarations(parallelConfig)
    const coldParallelManifest = readFileSync(resolve(
        root,
        outputRoot,
        '.graphql-precise-dts-manifest.json'
    ), 'utf8')
    const warmParallel = await generateDeclarations(parallelConfig)

    expect(coldParallel).toEqual(sequential)
    expect(warmParallel).toEqual(sequential)
    expect(coldParallelManifest).toBe(sequentialManifest)
})

test('keeps diagnostics and successful bundles equivalent across execution modes', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const invalidDocument = resolve(
        root,
        'projects/app/documents/queries/invalid.graphql'
    )
    writeFileSync(invalidDocument, 'query InvalidViewer { missing }')

    try {
        const sequential = await generateDeclarations(makeConfig(
            'generated/diagnostic-equivalence',
            '.cache/diagnostic-sequential',
            { mode: 'sequential' }
        ))
        const parallel = await generateDeclarations(makeConfig(
            'generated/diagnostic-equivalence',
            '.cache/diagnostic-parallel',
            { mode: 'parallel', maxWorkers: 2 }
        ))

        expect(parallel).toEqual(sequential)
        expect(parallel.diagnostics).toEqual([
            expect.objectContaining({
                severity: 'error',
                sourceId: 'queries/invalid.graphql',
                message: 'Type "Query" does not define field "missing"',
            }),
            expect.objectContaining({
                severity: 'warning',
                code: 'repeated-fragment-spread',
                sourceId: 'queries/viewer.graphql',
            }),
        ])
        expect(parallel.outputs.length).toBeGreaterThan(0)
        expect(existsSync(resolve(root, 'generated/diagnostic-equivalence'))).toBe(false)
    } finally {
        rmSync(invalidDocument)
    }
})

test('persists, reuses and repairs a schema snapshot cache', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const cacheFile = resolve(root, '.cache/persistent/schemas/core.json')
    const config = makeConfig(
        'generated/persistent-cache',
        '.cache/persistent',
        { mode: 'sequential' }
    )

    await generateDeclarations(config)
    const firstEntry = JSON.parse(readFileSync(cacheFile, 'utf8'))
    const fixedTimestamp = new Date('2001-02-03T04:05:06.000Z')
    utimesSync(cacheFile, fixedTimestamp, fixedTimestamp)

    await generateDeclarations(config)

    expect(statSync(cacheFile).mtimeMs).toBe(fixedTimestamp.getTime())
    expect(firstEntry).toMatchObject({
        formatVersion: 2,
        schemaId: 'core',
        schemaFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        semanticConfigHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        snapshotHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        snapshot: {
            formatVersion: 1,
            schemaFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
    })

    writeFileSync(cacheFile, 'not json')
    await generateDeclarations(config)

    expect(JSON.parse(readFileSync(cacheFile, 'utf8'))).toEqual(firstEntry)

    const invalidSnapshotEntry = {
        ...firstEntry,
        snapshot: { formatVersion: 1 },
    }
    writeFileSync(cacheFile, JSON.stringify(invalidSnapshotEntry))
    await generateDeclarations(config)

    expect(JSON.parse(readFileSync(cacheFile, 'utf8'))).toEqual(firstEntry)

    writeFileSync(cacheFile, JSON.stringify({
        ...firstEntry,
        snapshotHash: 'sha256:corrupted',
    }))
    await generateDeclarations(config)

    expect(JSON.parse(readFileSync(cacheFile, 'utf8'))).toEqual(firstEntry)

    writeFileSync(cacheFile, JSON.stringify({
        ...firstEntry,
        formatVersion: 3,
    }))
    await generateDeclarations(config)

    expect(JSON.parse(readFileSync(cacheFile, 'utf8'))).toEqual(firstEntry)
})

test('can disable persistent schema caching', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const config = makeConfig(
        'generated/cache-disabled',
        '.cache/disabled',
        { mode: 'sequential' }
    )
    Object.assign(config.cache, { enabled: false })

    await generateDeclarations(config)

    expect(existsSync(resolve(root, '.cache/disabled'))).toBe(false)
})

test('keeps check read-only when no schema cache exists', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const config = makeConfig(
        'generated/read-only-check',
        '.cache/read-only-check',
        { mode: 'parallel', maxWorkers: 2 }
    )

    const result = await checkDeclarations(config)

    expect(result.differences.length).toBeGreaterThan(0)
    expect(existsSync(resolve(root, '.cache/read-only-check'))).toBe(false)
    expect(existsSync(resolve(root, 'generated/read-only-check'))).toBe(false)
})

test('does not load or cache an unused schema', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const result = await generateDeclarations(defineConfig({
        root,
        cache: { directory: '.cache/unused-schema' },
        schemas: {
            unused: {
                file: 'schemas/missing.graphql',
                typesModule: '@app/graphql/unused-schema',
            },
        },
        projects: {},
    }))

    expect(result).toEqual({ outputs: [], diagnostics: [] })
    expect(existsSync(resolve(root, '.cache/unused-schema'))).toBe(false)
})

test('rejects a concurrent generator holding the same project lock', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const lockFile = resolve(root, '.graphql-precise-dts/locks/app.lock')
    mkdirSync(resolve(lockFile, '..'), { recursive: true })
    writeFileSync(lockFile, JSON.stringify({
        pid: process.pid,
        token: 'another-generator',
    }))

    await expect(generateDeclarations(makeConfig(
        'generated/locked',
        '.cache/locked',
        { mode: 'sequential' }
    ))).rejects.toThrow('Project "app" is locked by another generator')
    expect(existsSync(resolve(root, 'generated/locked'))).toBe(false)

    rmSync(lockFile)
})

test('recovers a stale project lock and releases its own lock', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const lockFile = resolve(root, '.graphql-precise-dts/locks/app.lock')
    mkdirSync(resolve(lockFile, '..'), { recursive: true })
    writeFileSync(lockFile, JSON.stringify({
        pid: 2_000_000_000,
        token: 'stale-generator',
    }))

    const result = await generateDeclarations(makeConfig(
        'generated/stale-lock',
        '.cache/stale-lock',
        { mode: 'parallel', maxWorkers: 2 }
    ))

    expect(result.diagnostics).toEqual([{
        severity: 'warning',
        code: 'repeated-fragment-spread',
        projectId: 'app',
        targetId: 'core',
        schemaId: 'core',
        sourceId: 'queries/viewer.graphql',
        location: { line: 8, column: 9 },
        message: 'Repeated fragment spread "NodeIdentity" in query "Viewer" was merged; first occurrence is at 7:9',
    }])
    expect(existsSync(lockFile)).toBe(false)
})

test.each([
    'not json',
    '{}',
])('recovers a malformed project lock: %s', async lock => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const lockFile = resolve(root, '.graphql-precise-dts/locks/app.lock')
    mkdirSync(resolve(lockFile, '..'), { recursive: true })
    writeFileSync(lockFile, lock)

    await generateDeclarations(makeConfig(
        'generated/malformed-lock',
        '.cache/malformed-lock',
        { mode: 'sequential' }
    ))

    expect(existsSync(lockFile)).toBe(false)
})

test('does not release a project lock that was replaced while generating', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const lockFile = resolve(root, '.graphql-precise-dts/locks/app.lock')
    const generation = generateDeclarations(makeConfig(
        'generated/replaced-lock',
        '.cache/replaced-lock',
        { mode: 'parallel', maxWorkers: 2 }
    ))
    expect(existsSync(lockFile)).toBe(true)

    writeFileSync(lockFile, '{"pid":1,"token":"replacement"}\n')

    await generation

    expect(existsSync(lockFile)).toBe(true)
    rmSync(lockFile)
})

test('accepts a project lock removed while generating', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const lockFile = resolve(root, '.graphql-precise-dts/locks/app.lock')
    const generation = generateDeclarations(makeConfig(
        'generated/removed-lock',
        '.cache/removed-lock',
        { mode: 'parallel', maxWorkers: 2 }
    ))
    expect(existsSync(lockFile)).toBe(true)

    rmSync(lockFile)

    await generation

    expect(existsSync(lockFile)).toBe(false)
})

test('keeps unsafe schema and project IDs inside cache and lock directories', async () => {
    const root = resolve(fixturesRoot, 'selection-composition')
    const result = await generateDeclarations(defineConfig({
        root,
        cache: { directory: '.cache/unsafe-ids' },
        schemas: {
            '../schema': {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
            },
        },
        projects: {
            '../project': {
                root: 'projects/app/documents',
                targets: {
                    core: {
                        schema: '../schema',
                        documents: { glob: { include: ['**/*.graphql'] } },
                        outputs: { tree: { root: 'generated/unsafe-ids' } },
                    },
                },
            },
        },
    }))

    expect(result.diagnostics).toEqual([{
        severity: 'warning',
        code: 'repeated-fragment-spread',
        projectId: '../project',
        targetId: 'core',
        schemaId: '../schema',
        sourceId: 'queries/viewer.graphql',
        location: { line: 8, column: 9 },
        message: 'Repeated fragment spread "NodeIdentity" in query "Viewer" was merged; first occurrence is at 7:9',
    }])
    expect(readdirSync(resolve(root, '.cache/unsafe-ids/schemas'))).toHaveLength(1)
    expect(readdirSync(resolve(root, '.graphql-precise-dts/locks'))).toEqual([])
    expect(existsSync(resolve(root, '../project.lock'))).toBe(false)
})

test('propagates filesystem failures while opening project locks', async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-lock-root-'))
    const oversizedProjectId = 'p'.repeat(300)

    try {
        await expect(generateDeclarations(defineConfig({
            root: temporaryRoot,
            schemas: {},
            projects: {
                [oversizedProjectId]: {
                    root: '.',
                    targets: {},
                },
            },
        }))).rejects.toThrow()
    } finally {
        rmSync(temporaryRoot, { force: true, recursive: true })
    }
})
