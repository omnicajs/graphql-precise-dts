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
})
