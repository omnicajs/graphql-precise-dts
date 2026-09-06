import {
    afterAll,
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import type { CodegenConfig } from '@/integrations/codegen'
import type { Types } from '@graphql-codegen/plugin-helpers'

import { buildSchema, parse } from 'graphql'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { plugin } from '@/integrations/codegen'
import {
    existsSync,
    globSync,
    readFileSync,
} from 'node:fs'
import { relative, resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixtureRoot = resolve(fixtureWorkspace.root, 'single-schema-project')
const documentRoot = resolve(fixtureRoot, 'projects/app/documents')

afterAll(fixtureWorkspace.dispose)

const schema = buildSchema(`
    type Query {
        viewer: User!
    }

    type User {
        id: ID!
        name: String!
    }
`)

const makeDocument = (
    location: string,
    source: string,
    rawSDL?: string
): Types.DocumentFile => ({
    location,
    document: parse(source),
    ...(rawSDL === undefined ? {} : { rawSDL }),
})

describe('GraphQL Code Generator integration', () => {
    test('adapts a complete single-schema project into one aggregate without a side-effect tree', async () => {
        const documents = globSync(resolve(documentRoot, '**/*.graphql')).map(file => ({
            location: file,
            rawSDL: readFileSync(file, 'utf8'),
            document: parse(readFileSync(file, 'utf8')),
        }))
        const output = await plugin(buildSchema(readFileSync(
            resolve(fixtureRoot, 'schemas/main/schema.graphql'),
            'utf8'
        )), documents, {
            root: documentRoot,
            typesModule: '@case/schema',
            enumsModule: '@case/enums',
            scalars: {
                DateTime: { kind: 'named', name: 'string' },
            },
            resolve: {
                alias: {
                    '.': '~tests/fixtures/documents',
                },
            },
        })

        expect(output).toBe(readFileSync(
            resolve(fixtureRoot, 'expected/aggregate.d.ts'),
            'utf8'
        ))
        expect(existsSync(resolve(fixtureRoot, 'codegen/schema.d.ts'))).toBe(false)
        expect(existsSync(resolve(fixtureRoot, 'codegen/enums.ts'))).toBe(false)
        expect(existsSync(resolve(fixtureRoot, 'codegen/.graphql-precise-dts-manifest.json')))
            .toBe(false)
    })

    test('uses the current directory and AST source when optional adapter inputs are absent', async () => {
        const location = 'tests/fixtures/cases/codegen-inline.graphql'
        const output = await plugin(schema, [ makeDocument(
            location,
            'query Viewer { viewer { id } }'
        ) ], { typesModule: '@app/graphql/schema' })

        expect(output).toContain(`declare module '${location}'`)
        expect(output).toContain(
            `import type { TypedDocumentNode } from '@graphql-typed-document-node/core'`
        )
    })

    test('falls back to raw SDL when the parsed document does not retain its source', async () => {
        const document = parse('query Viewer { viewer { id } }')
        const output = await plugin(schema, [{
            location: 'viewer.graphql',
            document: { ...document, loc: undefined },
            rawSDL: 'query Viewer { viewer { id } }',
        }], {
            root: process.cwd(),
            typesModule: '@app/graphql/schema',
        })

        expect(output).toContain(`declare module 'viewer.graphql'`)
    })

    test('accepts a parsed document without recoverable source text', async () => {
        const document = parse('query Viewer { viewer { id } }')
        const output = await plugin(schema, [{
            location: 'viewer.graphql',
            document: { ...document, loc: undefined },
        }], {
            root: process.cwd(),
            typesModule: '@app/graphql/schema',
        })

        expect(output).toContain(`declare module 'viewer.graphql'`)
    })

    test.each([
        [ null, 'Invalid Codegen plugin configuration at "config": expected an object' ],
        [ {}, 'Invalid Codegen plugin configuration at "typesModule": expected a string' ],
        [ { root: 42, typesModule: '@app/graphql/schema' }, 'Invalid Codegen plugin configuration at "root": expected a string' ],
        [ { typesModule: '@app/graphql/schema', enumsModule: 42 }, 'Invalid Codegen plugin configuration at "enumsModule": expected a string' ],
        [ { typesModule: '@app/graphql/schema', scalars: { DateTime: {} } }, 'Invalid Codegen plugin configuration at "scalars.DateTime": expected an input or output mapping' ],
        [ { typesModule: '@app/graphql/schema', directives: { cached: { effect: 'missing' } } }, 'Invalid Codegen plugin configuration at "directives.cached.effect": unknown field directive effect' ],
        [ { typesModule: '@app/graphql/schema', naming: 'titleCase' }, 'Invalid Codegen plugin configuration at "naming": unknown naming style' ],
        [ { typesModule: '@app/graphql/schema', resolve: { alias: { src: 42 } } }, 'Invalid Codegen plugin configuration at "resolve.alias.src": expected a string' ],
    ] as const)('validates the complete adapter configuration: %j', async (config, message) => {
        await expect(plugin(schema, [], config as unknown as CodegenConfig)).rejects.toThrow(
            message
        )
    })

    test('allows framework-owned Codegen configuration fields', async () => {
        const output = await plugin(schema, [], {
            typesModule: '@app/graphql/schema',
            importExtension: '.js',
            emitLegacyCommonJSImports: false,
        } as CodegenConfig)

        expect(output).toBe('\n')
    })

    test('requires every Codegen document to have a location and parsed AST', async () => {
        await expect(plugin(schema, [{ document: parse('query Viewer { viewer { id } }') }], {
            typesModule: '@app/graphql/schema',
        })).rejects.toThrow('Codegen document at index 0 does not have a location')

        await expect(plugin(schema, [{ location: 'viewer.graphql' }], {
            typesModule: '@app/graphql/schema',
        })).rejects.toThrow('Codegen document "viewer.graphql" does not have a parsed document')
    })

    test('rejects document locations outside the configured root', async () => {
        await expect(plugin(schema, [ makeDocument(
            resolve(documentRoot, '../outside.graphql'),
            'query Viewer { viewer { id } }'
        ) ], {
            root: documentRoot,
            typesModule: '@app/graphql/schema',
        })).rejects.toThrow('Codegen document must be inside root')
    })

    test('rejects module ID collisions after resolving aliases', async () => {
        await expect(plugin(schema, [
            makeDocument('first/viewer.graphql', 'query First { viewer { id } }'),
            makeDocument('second/viewer.graphql', 'query Second { viewer { id } }'),
        ], {
            root: process.cwd(),
            typesModule: '@app/graphql/schema',
            resolve: {
                alias: {
                    first: 'same',
                    second: 'same',
                },
            },
        })).rejects.toThrow(
            'Module ID "same/viewer.graphql" is resolved from both '
            + '"first/viewer.graphql" and "second/viewer.graphql" in Codegen adapter'
        )
    })

    test('publishes compiler warnings while returning the generated aggregate', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const location = resolve(process.cwd(), 'viewer-warning.graphql')

        try {
            const output = await plugin(schema, [ makeDocument(
                location,
                'query Viewer { viewer { id id } }',
                'query Viewer { viewer { id id } }'
            ) ], {
                root: process.cwd(),
                typesModule: '@app/graphql/schema',
            })

            expect(output).toContain(`declare module '${relative(process.cwd(), location)}'`)
            expect(warn).toHaveBeenCalledWith(
                'viewer-warning.graphql:1:28 [repeated-field-selection] '
                + 'Repeated field selection "id" in query "Viewer" was merged; '
                + 'first occurrence is at 1:25'
            )
        } finally {
            warn.mockRestore()
        }
    })

    test('rejects the Codegen run with located compiler diagnostics', async () => {
        await expect(plugin(schema, [ makeDocument(
            resolve(process.cwd(), 'viewer-invalid.graphql'),
            'query Viewer { missing }'
        ) ], {
            root: process.cwd(),
            typesModule: '@app/graphql/schema',
        })).rejects.toThrow([
            'GraphQL declaration generation failed:',
            'viewer-invalid.graphql:1:16 [invalid-document] Type "Query" does not define field "missing"',
        ].join('\n'))
    })
})
