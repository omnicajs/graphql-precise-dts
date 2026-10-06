import { afterAll, expect, test } from 'vitest'
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { checkDeclarations, defineConfig, generateDeclarations } from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'

const workspace = createFixtureWorkspace()
const root = resolve(workspace.root, 'cli')
afterAll(workspace.dispose)

const configFor = (outputRoot: string, files: ReadonlyArray<string> = ['viewer.graphql']) => defineConfig({
    root,
    schemas: {
        core: {
            file: 'schema.graphql',
            typesModule: '@app/graphql/schema',
            outputs: { root: `${outputRoot}/schema`, types: 'schema.d.ts' },
        },
    },
    projects: {
        app: {
            root: 'documents',
            targets: {
                core: {
                    schema: 'core',
                    documents: { files },
                    outputs: { tree: { root: outputRoot } },
                },
            },
        },
    },
})

test('force adopts planned files, preserves unknown files, and reports each dirty root', async () => {
    const config = configFor('adopted')
    mkdirSync(resolve(root, 'adopted/legacy'), { recursive: true })
    mkdirSync(resolve(root, 'adopted/schema'), { recursive: true })
    writeFileSync(resolve(root, 'adopted/viewer.graphql.d.ts'), 'old declaration')
    writeFileSync(resolve(root, 'adopted/schema/schema.d.ts'), 'old schema declaration')
    writeFileSync(resolve(root, 'adopted/legacy/old.graphql.d.ts'), 'old untracked declaration')
    writeFileSync(resolve(root, 'adopted/.keep'), 'keep this hidden file')
    writeFileSync(resolve(root, 'adopted/schema/schema.graphql'), 'keep this schema source')
    symlinkSync(resolve(root, 'documents'), resolve(root, 'adopted/linked-documents'))

    const result = await generateDeclarations(config, { force: true })
    expect(result.diagnostics).toEqual([])
    expect(result.warnings).toEqual([
        {
            code: 'dirty-output',
            root: 'adopted',
            files: ['adopted/.keep', 'adopted/legacy/old.graphql.d.ts', 'adopted/linked-documents'],
        },
        {
            code: 'dirty-output',
            root: 'adopted/schema',
            files: ['adopted/schema/schema.graphql'],
        },
    ])
    expect(readFileSync(resolve(root, 'adopted/viewer.graphql.d.ts'), 'utf8'))
        .toBe(workspace.readFixture('cli/expected/app/viewer.graphql.d.ts'))
    expect(readFileSync(resolve(root, 'adopted/schema/schema.d.ts'), 'utf8'))
        .toBe(workspace.readFixture('cli/expected/schema.d.ts'))
    expect(readFileSync(resolve(root, 'adopted/legacy/old.graphql.d.ts'), 'utf8'))
        .toBe('old untracked declaration')
    expect(readFileSync(resolve(root, 'adopted/.keep'), 'utf8')).toBe('keep this hidden file')
    expect(readFileSync(resolve(root, 'adopted/schema/schema.graphql'), 'utf8'))
        .toBe('keep this schema source')
    expect(readFileSync(resolve(root, 'adopted/linked-documents/viewer.graphql'), 'utf8'))
        .toBe(workspace.readFixture('cli/documents/viewer.graphql'))
    expect(JSON.parse(readFileSync(
        resolve(root, 'adopted/.graphql-precise-dts-manifest.json'), 'utf8'
    )).files.map((file: { path: string }) => file.path)).toEqual(['viewer.graphql.d.ts'])
    expect((await checkDeclarations(config)).differences).toEqual([])

    const repeated = await generateDeclarations(config, { force: true })
    expect(repeated.warnings).toEqual(result.warnings)
})

test('force creates missing output roots without dirty-area warnings', async () => {
    const result = await generateDeclarations(configFor('fresh'), { force: true })
    expect(result.diagnostics).toEqual([])
    expect(result.warnings).toBeUndefined()
    expect(existsSync(resolve(root, 'fresh/viewer.graphql.d.ts'))).toBe(true)
})

test('force preserves source files when schema outputs share the configuration root', async () => {
    const schemaRoot = resolve(root, 'shared-schema-root')
    mkdirSync(schemaRoot)
    const source = workspace.readFixture('cli/schema.graphql')
    writeFileSync(resolve(schemaRoot, 'schema.graphql'), source)
    writeFileSync(resolve(schemaRoot, 'schema.d.ts'), 'legacy schema declaration')
    writeFileSync(resolve(schemaRoot, 'viewer.graphql'), workspace.readFixture('cli/documents/viewer.graphql'))
    const result = await generateDeclarations(defineConfig({
        root: schemaRoot,
        cache: { enabled: false },
        schemas: {
            core: {
                file: 'schema.graphql',
                typesModule: '@app/graphql/schema',
                outputs: { root: '.', types: 'schema.d.ts' },
            },
        },
        projects: {
            app: {
                root: '.',
                targets: {
                    core: {
                        schema: 'core',
                        documents: { files: ['viewer.graphql'] },
                        outputs: { tree: { root: '.' } },
                    },
                },
            },
        },
    }), { force: true })

    expect(result.warnings).toEqual([{
        code: 'dirty-output',
        root: '.',
        files: ['schema.graphql', 'viewer.graphql'],
    }])
    expect(readFileSync(resolve(schemaRoot, 'schema.graphql'), 'utf8')).toBe(source)
    expect(readFileSync(resolve(schemaRoot, 'schema.d.ts'), 'utf8'))
        .toBe(workspace.readFixture('cli/expected/schema.d.ts'))
})

test('force leaves legacy files untouched when compilation fails', async () => {
    const config = configFor('invalid', ['broken.graphql'])
    mkdirSync(resolve(root, 'invalid'), { recursive: true })
    writeFileSync(resolve(root, 'invalid/viewer.graphql.d.ts'), 'legacy declaration')
    writeFileSync(resolve(root, 'documents/broken.graphql'), 'query Broken { missing }')

    const result = await generateDeclarations(config, { force: true })
    expect(result.diagnostics).toMatchObject([{ severity: 'error', code: 'invalid-document' }])
    expect(result.warnings).toBeUndefined()
    expect(readFileSync(resolve(root, 'invalid/viewer.graphql.d.ts'), 'utf8')).toBe('legacy declaration')
    expect(existsSync(resolve(root, 'invalid/.graphql-precise-dts-manifest.json'))).toBe(false)
})
