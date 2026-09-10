import {
    afterAll,
    expect,
    test,
} from 'vitest'

import {
    type Config,
    defineConfig,
    defineNamed,
    defineString,
    generateDeclarations,
    listProjects,
} from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root

afterAll(fixtureWorkspace.dispose)

const makeRuntimeConfig = (): Config => ({
    root: resolve(fixturesRoot, 'publication'),
    resolve: {
        alias: {
            'projects/app/documents': '@app',
        },
    },
    schemas: {
        core: {
            file: 'schemas/core/schema.graphql',
            typesModule: '@app/graphql/schema',
            enumsModule: '@app/graphql/enums',
            scalars: {
                String: defineString(),
                DateTime: {
                    input: defineString(),
                    output: defineNamed('Date'),
                },
            },
            directives: {
                include: { effect: 'conditional' },
            },
            naming: {
                typeNames: 'pascalCase',
                operationNames: 'camelCase',
                fragmentNames: 'snakeCase',
            },
            outputs: {
                root: 'runtime/schema',
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
                    documents: { files: ['queries/users.graphql'] },
                    outputs: {
                        tree: { root: 'runtime/operations' },
                        aggregate: { file: 'all.d.ts' },
                    },
                },
            },
        },
    },
})

const replaceConfigValue = (
    config: Config,
    path: ReadonlyArray<string>,
    value: unknown
): Config => {
    let owner = config as unknown as Record<string, unknown>
    for (const key of path.slice(0, -1)) owner = owner[key] as Record<string, unknown>
    owner[path[path.length - 1]!] = value

    return config
}

test('validates the complete runtime configuration before reading sources', async () => {
    expect((await generateDeclarations(makeRuntimeConfig())).diagnostics).toEqual([])
})

test.each([
    [ null, 'config": expected an object' ],
    [ { root: '/workspace', schemas: null, projects: {} }, 'schemas": expected an object' ],
    [ { root: 42, schemas: {}, projects: {} }, 'root": expected a string' ],
] as const)('rejects an invalid configuration shape', (config, message) => {
    expect(() => generateDeclarations(config as unknown as Config)).toThrow(message)
})

test('requires an absolute configuration root', () => {
    expect(() => generateDeclarations(defineConfig({
        root: 'fixtures',
        schemas: {},
        projects: {},
    }))).toThrow('Invalid configuration at "root": expected an absolute path')
})

test.each([
    [ [ 'unexpected' ], 'config.unexpected": unknown property' ],
    [
        [ 'projects', 'app', 'targets', 'core', 'documents', 'unexpected' ],
        'projects.app.targets.core.documents.unexpected": unknown property',
    ],
] as const)('rejects unknown configuration properties at %j', (path, message) => {
    expect(() => generateDeclarations(replaceConfigValue(
        makeRuntimeConfig(),
        path,
        true
    ))).toThrow(message)
})

test('rejects an unknown schema from untyped runtime configuration', () => {
    const config = makeRuntimeConfig()

    expect(() => generateDeclarations(replaceConfigValue(
        config,
        [ 'projects', 'app', 'targets', 'core', 'schema' ],
        'missing'
    ))).toThrow(
        'Invalid configuration at "projects.app.targets.core.schema": unknown schema "missing"'
    )
})

test('distinguishes an inherited property from an explicitly configured schema ID', async () => {
    const config = makeRuntimeConfig()

    expect(() => generateDeclarations(replaceConfigValue(
        config,
        [ 'projects', 'app', 'targets', 'core', 'schema' ],
        'toString'
    ))).toThrow(
        'Invalid configuration at "projects.app.targets.core.schema": unknown schema "toString"'
    )

    const ownSchemaConfig = makeRuntimeConfig()
    ownSchemaConfig.schemas = { toString: ownSchemaConfig.schemas.core! }
    replaceConfigValue(
        ownSchemaConfig,
        [ 'projects', 'app', 'targets', 'core', 'schema' ],
        'toString'
    )

    expect((await generateDeclarations(ownSchemaConfig)).diagnostics).toEqual([])
})

test.each([
    [
        [ 'schemas', 'core', 'scalars', 'String' ],
        {},
        'schemas.core.scalars.String": expected an input or output mapping',
    ],
    [
        [ 'schemas', 'core', 'scalars', 'String' ],
        { kind: 'missing' },
        'schemas.core.scalars.String.kind": expected a TypeScript type',
    ],
    [
        [ 'schemas', 'core', 'scalars', 'String' ],
        { kind: 'union', types: [] },
        'schemas.core.scalars.String.types": expected at least one type',
    ],
    [
        [ 'schemas', 'core', 'scalars', 'String' ],
        {
            kind: 'object',
            fields: [{
                name: 'value',
                optional: 'yes',
                type: { kind: 'unknown' },
            }],
        },
        'schemas.core.scalars.String.fields.0.optional": expected boolean',
    ],
    [
        [ 'schemas', 'core', 'directives', 'include', 'effect' ],
        'invalid',
        'schemas.core.directives.include.effect": unknown field directive effect',
    ],
    [
        [ 'schemas', 'core', 'directives', 'include' ],
        { fragmentSpread: { effect: 'override', type: defineString() } },
        'schemas.core.directives.include.fragmentSpread.effect": unknown directive effect',
    ],
    [
        [ 'schemas', 'core', 'directives', 'include' ],
        {},
        'schemas.core.directives.include": expected at least one selection policy',
    ],
    [
        [ 'schemas', 'core', 'naming' ],
        'invalid',
        'schemas.core.naming": unknown naming style',
    ],
] as const)('rejects invalid schema configuration at %j', (path, value, message) => {
    expect(() => generateDeclarations(replaceConfigValue(
        makeRuntimeConfig(),
        path,
        value
    ))).toThrow(message)
})

test.each([
    [
        [ 'schemas', 'core', 'enumsModule' ],
        undefined,
        'schemas.core.outputs.enums": requires enumsModule',
    ],
    [
        [ 'schemas', 'core', 'outputs', 'enums' ],
        undefined,
        'schemas.core.outputs.enums": is required when enumsModule is configured',
    ],
] as const)('validates schema output relationships', (path, value, message) => {
    expect(() => generateDeclarations(replaceConfigValue(
        makeRuntimeConfig(),
        path,
        value
    ))).toThrow(message)
})

test.each([
    [ {}, 'expected exactly one document selector' ],
    [ { files: [], regexp: /graphql$/ }, 'expected exactly one document selector' ],
    [ { files: 'queries/users.graphql' }, 'expected an array of strings' ],
    [ { regexp: 'graphql$' }, 'expected a RegExp' ],
] as const)('rejects an invalid document selector', (documents, message) => {
    expect(() => generateDeclarations(replaceConfigValue(
        makeRuntimeConfig(),
        [ 'projects', 'app', 'targets', 'core', 'documents' ],
        documents
    ))).toThrow(message)
})

test.each([ /graphql$/g, /graphql$/y ])(
    'rejects a stateful document selector: %s',
    regexp => {
        expect(() => generateDeclarations(replaceConfigValue(
            makeRuntimeConfig(),
            [ 'projects', 'app', 'targets', 'core', 'documents' ],
            { regexp }
        ))).toThrow('must not use the g or y flag')
    }
)

test('accepts an empty resolve section', async () => {
    const config = makeRuntimeConfig()
    config.resolve = {}

    expect((await generateDeclarations(config)).diagnostics).toEqual([])
})

test.each([
    [
        [ 'execution' ],
        { mode: 'concurrent' },
        'execution.mode": expected sequential or parallel',
    ],
    [
        [ 'execution' ],
        { mode: 'parallel' },
        'execution.maxWorkers": is required for parallel execution',
    ],
    [
        [ 'execution' ],
        { mode: 'parallel', maxWorkers: 0 },
        'execution.maxWorkers": expected a positive integer',
    ],
    [
        [ 'execution' ],
        { mode: 'sequential', maxWorkers: 2 },
        'execution.maxWorkers": is only allowed for parallel execution',
    ],
    [
        [ 'cache' ],
        { enabled: 'yes' },
        'cache.enabled": expected a boolean',
    ],
    [
        [ 'locks' ],
        { directory: 42 },
        'locks.directory": expected a string',
    ],
    [
        [ 'locks' ],
        { enabled: false },
        'locks.enabled": unknown property',
    ],
] as const)('rejects invalid execution, cache or locks configuration at %j', (path, value, message) => {
    expect(() => generateDeclarations(replaceConfigValue(
        makeRuntimeConfig(),
        path,
        value
    ))).toThrow(message)
})

test('lists configured project IDs in deterministic order', () => {
    const config = makeRuntimeConfig()
    config.projects = {
        reports: config.projects.app!,
        app: config.projects.app!,
    }

    expect(listProjects(config)).toEqual(['app', 'reports'])
})

test('defines a multi-schema consumer configuration', () => {
    const config = defineConfig({
        root: '/workspace',
        resolve: {
            alias: {
                src: '@app',
            },
        },
        schemas: {
            core: {
                file: 'schemas/core.graphql',
                typesModule: '@app/graphql/schema',
                enumsModule: '@app/graphql/enums',
                scalars: {
                    Timestamp: {
                        input: defineString(),
                        output: defineNamed('Date'),
                    },
                },
                naming: {
                    typeNames: 'pascalCase',
                    operationNames: 'camelCase',
                },
            },
            analytics: {
                file: 'schemas/analytics.graphql',
                typesModule: '@analytics/graphql/schema',
            },
        },
        projects: {
            app: {
                root: 'src',
                targets: {
                    core: {
                        schema: 'core',
                        documents: { glob: { include: ['**/*.graphql'] } },
                        outputs: { tree: { root: 'generated/graphql/core' } },
                    },
                },
            },
            reports: {
                root: 'reports',
                targets: {
                    analytics: {
                        schema: 'analytics',
                        documents: { regexp: /\.graphql$/ },
                        outputs: { tree: { root: 'generated/reports' } },
                    },
                },
            },
        },
    })

    expect(config.projects.app.targets.core.schema).toBe('core')
    expect(config.resolve.alias.src).toBe('@app')
    expect(config.projects.reports.targets.analytics.schema).toBe('analytics')
    expect(config.schemas.core.naming).toEqual({
        typeNames: 'pascalCase',
        operationNames: 'camelCase',
    })
    expect(config.schemas.core.scalars?.Timestamp).toEqual({
        input: { kind: 'named', name: 'string' },
        output: { kind: 'named', name: 'Date' },
    })
})

test('uses scalar type helpers in the public generation operation', async () => {
    const result = await generateDeclarations(defineConfig({
        root: resolve(fixturesRoot, 'scalar-mappings'),
        schemas: {
            core: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
                scalars: {
                    Timestamp: {
                        input: defineString(),
                        output: defineNamed('Date'),
                    },
                },
            },
        },
        projects: {
            events: {
                root: 'projects/app/documents',
                targets: {
                    core: {
                        schema: 'core',
                        documents: { files: ['queries/event.graphql'] },
                        outputs: { tree: { root: 'generated/events' } },
                    },
                },
            },
        },
    }))

    expect(result.diagnostics).toEqual([])
    expect(result.outputs[0]?.content).toContain('at: string;')
    expect(result.outputs[0]?.content).toContain('event: Date;')
})
