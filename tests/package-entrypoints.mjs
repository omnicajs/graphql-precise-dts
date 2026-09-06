import assert from 'node:assert/strict'
import {
    cpSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
    dirname,
    join,
    resolve,
} from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { generate } from '@graphql-codegen/cli'

import * as api from '@omnicajs/graphql-precise-dts'
import { plugin } from '@omnicajs/graphql-precise-dts/codegen'

const require = createRequire(import.meta.url)
const commonJsApi = require('@omnicajs/graphql-precise-dts')
const commonJsCodegen = require('@omnicajs/graphql-precise-dts/codegen')
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(repositoryRoot, 'dist/cli.mjs')
const fixture = resolve(repositoryRoot, 'tests/fixtures/cases/cli')
const codegenFixture = resolve(
    repositoryRoot,
    'tests/fixtures/cases/single-schema-project'
)
const workspace = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-package-'))

const execute = command => spawnSync(
    process.execPath,
    [ cli, command ],
    { cwd: workspace, encoding: 'utf8' }
)

try {
    assert.equal(typeof api.generateDeclarations, 'function')
    assert.equal(typeof api.checkDeclarations, 'function')
    assert.equal(typeof api.listProjects, 'function')
    assert.equal(typeof commonJsApi.generateDeclarations, 'function')
    assert.equal(typeof plugin, 'function')
    assert.equal(typeof commonJsCodegen.plugin, 'function')
    assert.equal(readFileSync(cli, 'utf8').startsWith('#!/usr/bin/env node\n'), true)

    cpSync(fixture, workspace, { recursive: true })
    cpSync(
        resolve(workspace, 'documents/viewer.graphql'),
        resolve(workspace, 'documents/viewer-copy.graphql')
    )

    const codegenOutput = resolve(workspace, 'codegen/operations.d.ts')
    await generate({
        overwrite: true,
        silent: true,
        schema: resolve(workspace, 'schema.graphql'),
        documents: [ resolve(workspace, 'documents/viewer.graphql') ],
        generates: {
            [codegenOutput]: {
                plugins: [{
                    '@omnicajs/graphql-precise-dts/codegen': {
                        root: resolve(workspace, 'documents'),
                        typesModule: '@app/graphql/schema',
                    },
                }],
            },
        },
        pluginLoader(name) {
            if (name === '@omnicajs/graphql-precise-dts/codegen') return { plugin }

            throw Object.assign(new Error(`Unknown plugin: ${name}`), {
                code: 'ERR_MODULE_NOT_FOUND',
            })
        },
    })
    assert.match(readFileSync(codegenOutput, 'utf8'), /declare module 'viewer\.graphql'/)
    assert.equal(existsSync(resolve(workspace, 'codegen/schema.d.ts')), false)
    assert.equal(existsSync(resolve(workspace, 'codegen/enums.ts')), false)
    assert.match(
        readFileSync(resolve(repositoryRoot, 'dist/codegen.d.ts'), 'utf8'),
        /integrations\/codegen/
    )

    const commonJsGraphql = require('graphql')
    const commonJsCodegenOutput = await commonJsCodegen.plugin(
        commonJsGraphql.buildSchema(readFileSync(resolve(workspace, 'schema.graphql'), 'utf8')),
        [{
            location: resolve(workspace, 'documents/viewer.graphql'),
            document: commonJsGraphql.parse(readFileSync(
                resolve(workspace, 'documents/viewer.graphql'),
                'utf8'
            )),
        }],
        {
            root: resolve(workspace, 'documents'),
            typesModule: '@app/graphql/schema',
        }
    )
    assert.match(commonJsCodegenOutput, /declare module 'viewer\.graphql'/)

    const singleSchemaDocumentRoot = resolve(codegenFixture, 'projects/app/documents')
    const singleSchemaCodegenOutput = resolve(workspace, 'codegen-single-schema/operations.d.ts')
    await generate({
        overwrite: true,
        silent: true,
        schema: resolve(codegenFixture, 'schemas/main/schema.graphql'),
        documents: [ resolve(singleSchemaDocumentRoot, '**/*.graphql') ],
        generates: {
            [singleSchemaCodegenOutput]: {
                plugins: [{
                    '@omnicajs/graphql-precise-dts/codegen': {
                        root: singleSchemaDocumentRoot,
                        typesModule: './schema',
                        enumsModule: './enums',
                        scalars: {
                            DateTime: { kind: 'named', name: 'string' },
                        },
                        resolve: {
                            alias: {
                                '.': '~tests/fixtures/documents',
                            },
                        },
                    },
                }],
            },
        },
        pluginLoader(name) {
            if (name === '@omnicajs/graphql-precise-dts/codegen') return { plugin }

            throw Object.assign(new Error(`Unknown plugin: ${name}`), {
                code: 'ERR_MODULE_NOT_FOUND',
            })
        },
    })
    assert.equal(
        readFileSync(singleSchemaCodegenOutput, 'utf8'),
        readFileSync(resolve(codegenFixture, 'expected/experimental/types.d.ts'), 'utf8')
    )

    const sequentialConfig = api.defineConfig({
        root: workspace,
        cache: { enabled: false },
        execution: { mode: 'sequential' },
        schemas: {
            core: {
                file: 'schema.graphql',
                typesModule: '@app/graphql/schema',
            },
        },
        projects: {
            app: {
                root: 'documents',
                targets: {
                    core: {
                        schema: 'core',
                        documents: { files: [ 'viewer.graphql', 'viewer-copy.graphql' ] },
                        outputs: { tree: { root: 'generated-workers' } },
                    },
                },
            },
        },
    })
    const sequentialResult = await api.generateDeclarations(sequentialConfig)
    const sequentialManifest = readFileSync(resolve(
        workspace,
        'generated-workers/.graphql-precise-dts-manifest.json'
    ), 'utf8')
    rmSync(resolve(workspace, 'generated-workers'), { recursive: true })

    const parallelResult = await commonJsApi.generateDeclarations(commonJsApi.defineConfig({
        root: workspace,
        cache: { enabled: false },
        execution: { mode: 'parallel', maxWorkers: 2 },
        schemas: {
            core: {
                file: 'schema.graphql',
                typesModule: '@app/graphql/schema',
            },
        },
        projects: {
            app: {
                root: 'documents',
                targets: {
                    core: {
                        schema: 'core',
                        documents: { files: [ 'viewer.graphql', 'viewer-copy.graphql' ] },
                        outputs: { tree: { root: 'generated-workers' } },
                    },
                },
            },
        },
    }))
    assert.deepEqual(parallelResult, sequentialResult)
    assert.equal(readFileSync(resolve(
        workspace,
        'generated-workers/.graphql-precise-dts-manifest.json'
    ), 'utf8'), sequentialManifest)

    const generation = execute('generate')
    assert.equal(generation.error, undefined)
    assert.equal(generation.status, 0, generation.stderr)
    assert.equal(generation.stdout, 'Generated 1 declaration files.\n')

    const output = resolve(workspace, 'generated/viewer.graphql.d.ts')
    const manifest = resolve(workspace, 'generated/.graphql-precise-dts-manifest.json')
    const outputTimestamp = statSync(output).mtimeMs
    const manifestTimestamp = statSync(manifest).mtimeMs

    const check = execute('check')
    assert.equal(check.error, undefined)
    assert.equal(check.status, 0, check.stderr)
    assert.equal(check.stdout, 'Declarations are up to date.\n')
    assert.equal(statSync(output).mtimeMs, outputTimestamp)
    assert.equal(statSync(manifest).mtimeMs, manifestTimestamp)

    const projects = execute('list')
    assert.equal(projects.error, undefined)
    assert.equal(projects.status, 0, projects.stderr)
    assert.equal(projects.stdout, 'app\n')
} finally {
    rmSync(workspace, { force: true, recursive: true })
}
