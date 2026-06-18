import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { join } from 'path'
import {
    makeDeclarationModuleSpecifier,
    makeEnumsOutputFile,
    makeModuleSpecifier,
    makeSchemaDeclarationOutputFile,
    makeSchemaOutputDirectory,
} from '../../src/path'
import { parse } from 'graphql'
import { plugin } from '../../src'
import { withTempOutput } from './utils/temp-output'

describe('plugin module path resolution', () => {
    test('makes a module specifier between generated declaration files', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'src/generated/schema/schema.generated.d.ts')
        )).toBe('./schema/schema.generated')
    })

    test('makes a module specifier from declarations to generated TypeScript files', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'src/generated/schema/enums.ts')
        )).toBe('./schema/enums')
    })

    test('uses configured wildcard paths for generated declaration module specifiers', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/schema.d.ts'),
            {
                '@example/graphql/generated/*': [ 'packages/graphql/generated/*' ],
            }
        )).toBe('@example/graphql/generated/schema')
    })

    test('uses configured string target paths for generated declaration module specifiers', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/schema.d.ts'),
            {
                '@example/graphql/generated/*': 'packages/graphql/generated/*',
            }
        )).toBe('@example/graphql/generated/schema')
    })

    test('uses configured exact paths for generated declaration module specifiers', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/enums.ts'),
            {
                '@example/graphql/generated/enums': [ 'packages/graphql/generated/enums.ts' ],
            }
        )).toBe('@example/graphql/generated/enums')
    })

    test('uses configured exact string target paths for generated declaration module specifiers', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/schema.d.ts'),
            {
                '@example/graphql/generated/schema': 'packages/graphql/generated/schema.d.ts',
            }
        )).toBe('@example/graphql/generated/schema')
    })

    test('prefers the most specific configured path for generated declaration module specifiers', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/schema.d.ts'),
            {
                '@example/*': [ 'packages/*' ],
                '@example/graphql/generated/schema': [ 'packages/graphql/generated/schema.d.ts' ],
            }
        )).toBe('@example/graphql/generated/schema')
    })

    test('falls back to relative generated declaration module specifiers when exact paths do not match', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/schema.d.ts'),
            {
                '@example/graphql/generated/schema': [ 'other/generated/schema.d.ts' ],
            }
        )).toBe('../../packages/graphql/generated/schema')
    })

    test('falls back to relative generated declaration module specifiers when paths do not match', () => {
        expect(makeDeclarationModuleSpecifier(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'packages/graphql/generated/schema.d.ts'),
            {
                '@example/graphql/generated/*': [ 'other/generated/*' ],
            }
        )).toBe('../../packages/graphql/generated/schema')
    })

    test('uses generated declaration directory as schema output directory by default', () => {
        expect(makeSchemaOutputDirectory(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts')
        )).toBe(join(process.cwd(), 'src/generated'))
    })

    test('resolves a configured relative schema output directory from generated declarations', () => {
        expect(makeSchemaOutputDirectory(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            'schema'
        )).toBe(join(process.cwd(), 'src/generated/schema'))
    })

    test('keeps a configured absolute schema output directory', () => {
        expect(makeSchemaOutputDirectory(
            join(process.cwd(), 'src/generated/graphql-documents.generated.d.ts'),
            join(process.cwd(), 'schema-output')
        )).toBe(join(process.cwd(), 'schema-output'))
    })

    test('makes schema declaration output file inside schema output directory', () => {
        expect(makeSchemaDeclarationOutputFile(
            join(process.cwd(), 'src/generated/schema')
        )).toBe(join(process.cwd(), 'src/generated/schema/schema.d.ts'))
    })

    test('makes enums output file inside schema output directory', () => {
        expect(makeEnumsOutputFile(
            join(process.cwd(), 'src/generated/schema')
        )).toBe(join(process.cwd(), 'src/generated/schema/enums.ts'))
    })

    test('uses the scoped suffix when document location matches scope root', () => {
        expect(makeModuleSpecifier(
            '~tests/',
            'tests/fixtures/documents/fragments/UserDetails.graphql',
            false,
            'fixtures/documents/fragments/'
        )).toBe('~tests/fixtures/documents/fragments/UserDetails.graphql')
    })

    test('adds ./ to the scoped suffix when prefix is empty', () => {
        expect(makeModuleSpecifier(
            '',
            'tests/fixtures/documents/fragments/UserDetails.graphql',
            false,
            'fixtures/documents/fragments/'
        )).toBe('./fixtures/documents/fragments/UserDetails.graphql')
    })

    test('uses the normalized document path when scope does not match and relativeToCwd is disabled', () => {
        expect(makeModuleSpecifier(
            '~tests/',
            'queries/index.graphql',
            false,
            'fragments/never-matches/'
        )).toBe('~tests/queries/index.graphql')
    })

    test('uses the path relative to cwd when scope does not match and relativeToCwd is enabled', () => {
        const absoluteDocumentLocation = join(process.cwd(), 'queries/index.graphql')

        expect(makeModuleSpecifier(
            '~tests/',
            absoluteDocumentLocation,
            true,
            'fragments/never-matches/'
        )).toBe('~tests/queries/index.graphql')
    })

    test('adds ./ to the relative path when prefix is empty and relativeToCwd is enabled', () => {
        const absoluteDocumentLocation = join(process.cwd(), 'queries/index.graphql')

        expect(makeModuleSpecifier(
            '',
            absoluteDocumentLocation,
            true,
            'fragments/never-matches/'
        )).toBe('./queries/index.graphql')
    })

    test('keeps explicit relative module specifiers when prefix is empty', () => {
        expect(makeModuleSpecifier('', './queries/index.graphql')).toBe('./queries/index.graphql')
        expect(makeModuleSpecifier('', '../queries/index.graphql')).toBe('../queries/index.graphql')
    })

    test('keeps parent-relative module specifiers resolved from absolute paths when prefix is empty', () => {
        expect(makeModuleSpecifier(
            '',
            join(process.cwd(), '..', 'queries/index.graphql')
        )).toBe('../queries/index.graphql')
    })

    test('uses the normalized document path when scope is omitted and relativeToCwd is disabled', () => {
        expect(makeModuleSpecifier(
            '~tests/',
            'mutations/index.graphql'
        )).toBe('~tests/mutations/index.graphql')
    })

    test('uses the path relative to cwd for absolute document locations when relativeToCwd is disabled', () => {
        const absoluteDocumentLocation = join(process.cwd(), 'mutations/index.graphql')

        expect(makeModuleSpecifier(
            '~tests/',
            absoluteDocumentLocation,
            false
        )).toBe('~tests/mutations/index.graphql')
    })

    test('falls back to the default document name when location is missing', () => {
        expect(makeModuleSpecifier('~tests/')).toBe('~tests/*.graphql')
    })

    test('keeps the default document name unchanged when prefix is empty', () => {
        expect(makeModuleSpecifier('')).toBe('*.graphql')
    })

    test('keeps distinct module ids for documents with the same basename when scope does not match', async () => {
        const schema = buildSchema(`
            type Query {
                user: User!
                group: Group!
            }

            type User {
                id: ID!
            }

            type Group {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'queries/index.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }
                    `),
                }, {
                    location: 'mutations/index.graphql',
                    document: parse(`
                        fragment GroupDetails on Group {
                            id
                        }

                        query GroupQuery {
                            group {
                                ...GroupDetails
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scope: 'fragments/never-matches/',
                },
                outputInfo
            )

            expect(result).toContain(`declare module '~tests/queries/index.graphql' {`)
            expect(result).toContain(`declare module '~tests/mutations/index.graphql' {`)
            expect(result).toContain(`group: GroupDetails;`)

            expect(result).not.toContain(`import type { GroupDetails } from '~tests/mutations/index.graphql'`)
            expect(result).not.toContain(`declare module '~tests/index.graphql' {`)
        })
    })

    test('uses the default document module prefix when plugin prefix is omitted', async () => {
        const schema = buildSchema(`
            type Query {
                group: Group!
            }

            type Group {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupQuery {
                            group {
                                id
                            }
                        }
                    `),
                }],
                {},
                outputInfo
            )

            expect(result).toContain(`declare module '*/group.graphql' {`)
        })
    })

    test('uses configured paths for schema and enum imports in generated declarations', async () => {
        const schema = buildSchema(`
            enum Permission {
                Read
            }

            type Query {
                group(permission: Permission!): Group!
            }

            type Group {
                permission: Permission!
            }
        `)

        await withTempOutput(async outputInfo => {
            const schemaOutputDirectory = join(outputInfo.tempDir, 'packages/graphql/generated')
            const result = await plugin(
                schema,
                [{
                    location: 'queries/group.graphql',
                    document: parse(`
                        query GroupQuery($permission: Permission!) {
                            group(permission: $permission) {
                                permission
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    schemaOutputDirectory,
                    paths: {
                        '@example/graphql/generated/*': [ `${schemaOutputDirectory}/*` ],
                    },
                },
                outputInfo
            )

            expect(result).toContain(`\timport type { Exact } from '@example/graphql/generated/schema'`)
            expect(result).toContain(`\timport type { Permission } from '@example/graphql/generated/enums'`)

            expect(result).not.toContain(`from '../../packages/graphql/generated/schema'`)
            expect(result).not.toContain(`from '../../packages/graphql/generated/enums'`)
        })
    })
})
