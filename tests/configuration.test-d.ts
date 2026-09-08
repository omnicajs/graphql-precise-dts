import type {
    GenerateDeclarationsOptions,
    GenerateDeclarationsResult,
    LocksConfig,
    PublicationWarning,
    TsLiteralType,
    TsType,
} from '@/index'

import {
    describe,
    expectTypeOf,
    test,
} from 'vitest'

import {
    arrayOf,
    defineBoolean,
    defineConfig,
    defineGeneric,
    defineLiteral,
    defineNamed,
    defineNull,
    defineNumber,
    defineObject,
    defineObjectField,
    defineString,
    defineTuple,
    defineUnknown,
    generateDeclarations,
    intersectionOf,
    makeNullable,
    unionOf,
} from '@/index'

const schema = {
    file: 'schema.graphql',
    typesModule: '@app/graphql/schema',
    typename: 'abstract',
    naming: {
        typeNames: 'snakeCase',
        enumMembers: 'pascalCase',
    },
} as const

describe('configuration public types', () => {
    test('accepts an optional force flag for a generation invocation', () => {
        expectTypeOf<Parameters<typeof generateDeclarations>[1]>()
            .toEqualTypeOf<GenerateDeclarationsOptions | undefined>()
        expectTypeOf({ force: true }).toExtend<GenerateDeclarationsOptions>()
        expectTypeOf({}).toExtend<GenerateDeclarationsOptions>()
        expectTypeOf({ force: 'true' }).not.toExtend<GenerateDeclarationsOptions>()
        expectTypeOf<GenerateDeclarationsResult['warnings']>()
            .toEqualTypeOf<ReadonlyArray<PublicationWarning> | undefined>()
    })

    test('preserves schema and project identities', () => {
        const config = defineConfig({
            root: '/workspace',
            cache: {
                directory: '.cache/graphql',
            },
            locks: { directory: '.cache/graphql-locks' },
            execution: {
                mode: 'parallel',
                maxWorkers: 2,
            },
            resolve: {
                alias: {
                    src: '@app',
                },
            },
            schemas: {
                core: schema,
                analytics: {
                    ...schema,
                    enumsModule: '@app/graphql/enums',
                    outputs: {
                        root: 'generated/schema',
                        types: 'schema.d.ts',
                        enums: 'enums.ts',
                    },
                },
            },
            projects: {
                app: {
                    root: 'src',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['queries/viewer.graphql'] },
                            outputs: {
                                tree: { root: 'generated' },
                                aggregate: { file: 'all.d.ts' },
                            },
                        },
                    },
                },
            },
        })

        expectTypeOf(config.projects.app.targets.core.schema).toEqualTypeOf<'core'>()
        expectTypeOf(config.execution.mode).toEqualTypeOf<'parallel'>()
        expectTypeOf(config.execution.maxWorkers).toEqualTypeOf<number>()
        expectTypeOf(config.cache.directory).toEqualTypeOf<string>()
        expectTypeOf(config.locks.directory).toEqualTypeOf<string>()
        expectTypeOf({ directory: 42 }).not.toExtend<LocksConfig>()
        expectTypeOf(config.resolve.alias.src).toEqualTypeOf<string>()
        expectTypeOf<keyof typeof config.schemas>().toEqualTypeOf<'analytics' | 'core'>()
        expectTypeOf(config.schemas.core.typename).toEqualTypeOf<'abstract'>()
        expectTypeOf(config.schemas.core.naming.enumMembers).toEqualTypeOf<'pascalCase'>()
        expectTypeOf(config.schemas.core.naming.typeNames).toEqualTypeOf<'snakeCase'>()
        expectTypeOf(config.schemas.analytics.outputs.types).toEqualTypeOf<'schema.d.ts'>()
        expectTypeOf(config.projects.app.targets.core.outputs.aggregate.file)
            .toEqualTypeOf<'all.d.ts'>()
        expectTypeOf(defineNamed('Date').name).toEqualTypeOf<'Date'>()
    })

    test('rejects a target that references an unknown schema', () => {
        defineConfig({
            root: '/workspace',
            schemas: { core: schema },
            projects: {
                app: {
                    root: 'src',
                    targets: {
                        core: {
                            // @ts-expect-error Target schema must reference a configured schema ID.
                            schema: 'missing',
                            documents: { glob: { include: ['**/*.graphql'] } },
                            outputs: { tree: { root: 'generated' } },
                        },
                    },
                },
            },
        })
    })

    test('keeps sequential and parallel execution options exclusive', () => {
        defineConfig({
            root: '/workspace',
            schemas: { core: schema },
            projects: {},
            execution: {
                mode: 'sequential',
                // @ts-expect-error Sequential execution does not accept a worker bound.
                maxWorkers: 2,
            },
        })

        defineConfig({
            root: '/workspace',
            schemas: { core: schema },
            projects: {},
            // @ts-expect-error Parallel execution requires an explicit worker bound.
            execution: { mode: 'parallel' },
        })
    })

    test('exposes structured scalar types through configuration helpers', () => {
        const literal = defineLiteral('ready')
        const structured = intersectionOf(
            defineGeneric('Readonly', defineObject({
                enabled: defineObjectField(defineBoolean()),
                values: defineObjectField(arrayOf(makeNullable(defineNumber())), true),
            })),
            unionOf(
                defineTuple(defineString(), defineNull()),
                defineObject({ value: defineObjectField(defineUnknown()) })
            )
        )

        expectTypeOf(literal).toEqualTypeOf<TsLiteralType<'ready'>>()
        expectTypeOf(structured).toMatchTypeOf<TsType>()
        expectTypeOf(defineNamed('unknown')).toEqualTypeOf<ReturnType<typeof defineUnknown>>()

        // @ts-expect-error A union requires at least one member.
        unionOf()
        // @ts-expect-error A generic requires at least one type argument.
        defineGeneric('Readonly')
    })

    test('restricts field-only directive effects by selection kind', () => {
        defineConfig({
            root: '/workspace',
            schemas: {
                core: {
                    ...schema,
                    directives: {
                        opaque: { effect: 'override', type: defineNamed('OpaqueId') },
                        required: { effect: 'nonnull' },
                        review: {
                            field: { effect: 'warn' },
                            fragmentSpread: { effect: 'conditional' },
                            inlineFragment: { effect: 'ignore' },
                        },
                        invalid: {
                            // @ts-expect-error Type overrides only apply to fields.
                            fragmentSpread: { effect: 'override', type: defineNamed('OpaqueId') },
                        },
                    },
                },
            },
            projects: {},
        })
    })
})
