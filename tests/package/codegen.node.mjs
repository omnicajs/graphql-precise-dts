import assert from 'node:assert/strict'
import { test } from 'node:test'

import { generate } from '@graphql-codegen/cli'
import { plugin } from '@omnicajs/graphql-precise-dts/codegen'
import {
    mkdtempSync,
    readFileSync,
    rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
    dirname,
    join,
    resolve,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const loadPlugin = name => {
    if (name === '@omnicajs/graphql-precise-dts/codegen') return { plugin }

    throw Object.assign(new Error(`Unknown plugin: ${name}`), {
        code: 'ERR_MODULE_NOT_FOUND',
    })
}

test('generates abstract selections through GraphQL Code Generator', async context => {
    const fixture = resolve(
        repositoryRoot,
        'tests/fixtures/cases/abstract-selections'
    )
    const documents = resolve(fixture, 'projects/search-ui/documents')
    const workspace = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-codegen-abstract-'))
    const output = resolve(workspace, 'operations.d.ts')
    context.after(() => rmSync(workspace, { force: true, recursive: true }))

    await generate({
        overwrite: true,
        silent: true,
        schema: resolve(fixture, 'schemas/search/schema.graphql'),
        documents: [
            resolve(documents, 'queries/node.graphql'),
            resolve(documents, 'queries/search.graphql'),
        ],
        generates: {
            [output]: {
                plugins: [{
                    '@omnicajs/graphql-precise-dts/codegen': {
                        root: documents,
                        typesModule: '@search/graphql/schema',
                        enumsModule: '@search/graphql/enums',
                        scalars: {
                            DateTime: { kind: 'named', name: 'string' },
                        },
                        directives: {
                            includeArchived: { effect: 'conditional' },
                        },
                    },
                }],
            },
        },
        pluginLoader: loadPlugin,
    })

    assert.equal(
        readFileSync(output, 'utf8'),
        `${readFileSync(
            resolve(fixture, 'expected/search-ui/queries/node.graphql.d.ts'),
            'utf8'
        ).trimEnd()}\n\n${readFileSync(
            resolve(fixture, 'expected/search-ui/queries/search.graphql.d.ts'),
            'utf8'
        ).trimEnd()}\n`
    )
})
test('generates recursive input values through GraphQL Code Generator', async context => {
    const fixture = resolve(
        repositoryRoot,
        'tests/fixtures/cases/input-values'
    )
    const documents = resolve(fixture, 'projects/search-ui/documents')
    const workspace = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-codegen-inputs-'))
    const output = resolve(workspace, 'operations.d.ts')
    context.after(() => rmSync(workspace, { force: true, recursive: true }))

    await generate({
        overwrite: true,
        silent: true,
        schema: resolve(fixture, 'schemas/search/schema.graphql'),
        documents: [ resolve(documents, 'queries/search.graphql') ],
        generates: {
            [output]: {
                plugins: [{
                    '@omnicajs/graphql-precise-dts/codegen': {
                        root: documents,
                        typesModule: '@search/graphql/schema',
                        enumsModule: '@search/graphql/enums',
                    },
                }],
            },
        },
        pluginLoader: loadPlugin,
    })

    assert.equal(
        readFileSync(output, 'utf8'),
        readFileSync(
            resolve(fixture, 'expected/search-ui/queries/search.graphql.d.ts'),
            'utf8'
        )
    )
})
