import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import {
    defineNamed,
    defineNull,
    defineString,
} from '../../src'
import { existsSync } from 'fs'
import { join } from 'path'
import { readFileSync } from 'fs'
import {
    plugin,
    unionOf,
} from '../../src'
import { withTempOutput } from './utils/temp-output'

import {
    buildSchema,
    parse,
} from 'graphql'

const SCHEMA_HELPER_DECLARATIONS = [
    'export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }',
    'export type MaybePromise<T> = T | Promise<T>',
].join('\n')

const schema = buildSchema(`
    type Query {
        group: Group!
    }

    interface User {
        id: ID!
    }

    type Group {
        owner: User!
    }

    type UserPayload implements User {
        id: ID!
    }

    type AdminPayload implements User {
        id: ID!
    }
`)

describe('plugin skipped document warnings', () => {
    const getSkippedDocumentWarning = (location: string): string =>
        `Document "${location}" was skipped because no parsed GraphQL AST was provided to the plugin. `
        + 'Check the document for syntax errors or unsupported constructs; skipped documents are not included in generated declarations.'

    test.each([
        {
            name: 'empty field selection set',
            location: 'empty-selection.graphql',
            rawSDL: `
                query EmptySelection {
                    group {
                    }
                }
            `,
        },
        {
            name: 'unclosed operation selection',
            location: 'unclosed-operation.graphql',
            rawSDL: `
                query UnclosedOperation {
                    group {
                        owner {
                            id
                        }
            `,
        },
        {
            name: 'fragment without type condition',
            location: 'fragment-without-type.graphql',
            rawSDL: `
                fragment MissingTypeCondition {
                    id
                }
            `,
        },
        {
            name: 'field directive without name',
            location: 'invalid-directive.graphql',
            rawSDL: `
                query InvalidDirective {
                    group {
                        owner {
                            id @
                        }
                    }
                }
            `,
        },
    ])('warns when $name is skipped before plugin execution', async ({ location, rawSDL }) => {
        expect(() => parse(rawSDL)).toThrow()

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location,
                    document: undefined,
                    rawSDL,
                }, {
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(warn).toHaveBeenCalledWith(getSkippedDocumentWarning(location))

            expect(result).toContain(`declare module '~tests/group.graphql'`)
            expect(result).not.toContain(location)
        })

        warn.mockRestore()
    })

    test('warns for every skipped document in a mixed documents list', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'empty-selection.graphql',
                    document: undefined,
                    rawSDL: `
                        query EmptySelection {
                            group {
                            }
                        }
                    `,
                }, {
                    location: 'fragment-without-type.graphql',
                    document: undefined,
                    rawSDL: `
                        fragment MissingTypeCondition {
                            id
                        }
                    `,
                }, {
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(warn).toHaveBeenCalledWith(getSkippedDocumentWarning('empty-selection.graphql'))
            expect(warn).toHaveBeenCalledWith(getSkippedDocumentWarning('fragment-without-type.graphql'))

            expect(result).toContain(`declare module '~tests/group.graphql'`)
            expect(result).not.toContain('EmptySelection')
            expect(result).not.toContain('MissingTypeCondition')
        })

        warn.mockRestore()
    })
})

describe('plugin custom scalar diagnostics', () => {
    test('warns when custom scalar named TypeScript references overlap generated schema names', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        const diagnosticSchema = buildSchema(`
            scalar AsyncValue
            scalar DateTime
            scalar Cursor
            scalar Meta
            scalar Token

            enum Permission {
                Read
            }

            type User {
                id: ID!
            }

            type Query {
                asyncValue: AsyncValue!
                meta: Meta!
                token: Token!
                user(createdAt: DateTime!, cursor: Cursor): User!
            }
        `)

        await withTempOutput(async outputInfo => {
            await plugin(
                diagnosticSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        query UserQuery($createdAt: DateTime!, $cursor: Cursor) {
                            user(createdAt: $createdAt, cursor: $cursor) {
                                id
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scalars: {
                        AsyncValue: defineNamed('MaybePromise'),
                        Cursor: defineNamed('QueryUserArgs'),
                        DateTime: {
                            input: defineNamed('Permission'),
                            output: defineNamed('User'),
                        },
                        Meta: defineNamed('Scalars'),
                        Token: defineNamed('Exact'),
                    },
                },
                outputInfo
            )
        })

        expect(warn).toHaveBeenCalledWith(
            'Custom scalar "AsyncValue" maps to named TypeScript type "MaybePromise", '
            + 'which is also generated by the plugin as schema helper declaration. '
            + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
        )
        expect(warn).toHaveBeenCalledWith(
            'Custom scalar "Cursor" maps to named TypeScript type "QueryUserArgs", '
            + 'which is also generated by the plugin as field arguments helper declaration. '
            + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
        )
        expect(warn).toHaveBeenCalledWith(
            'Custom scalar "DateTime" input type maps to named TypeScript type "Permission", '
            + 'which is also generated by the plugin as enum declaration. '
            + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
        )
        expect(warn).toHaveBeenCalledWith(
            'Custom scalar "DateTime" output type maps to named TypeScript type "User", '
            + 'which is also generated by the plugin as GraphQL type declaration. '
            + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
        )
        expect(warn).toHaveBeenCalledWith(
            'Custom scalar "Meta" maps to named TypeScript type "Scalars", '
            + 'which is also generated by the plugin as schema helper declaration. '
            + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
        )
        expect(warn).toHaveBeenCalledWith(
            'Custom scalar "Token" maps to named TypeScript type "Exact", '
            + 'which is also generated by the plugin as schema helper declaration. '
            + 'This may make the scalar reference resolve to the generated declaration instead of an external type.'
        )

        warn.mockRestore()
    })

    test('does not warn when custom scalars map to primitive TypeScript names', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        const diagnosticSchema = buildSchema(`
            scalar DateTime

            type Query {
                createdAt: DateTime!
            }
        `)

        await withTempOutput(async outputInfo => {
            await plugin(
                diagnosticSchema,
                [{
                    location: 'date.graphql',
                    document: parse(`
                        query DateQuery {
                            createdAt
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scalars: {
                        DateTime: defineString(),
                    },
                },
                outputInfo
            )
        })

        expect(warn).not.toHaveBeenCalled()

        warn.mockRestore()
    })
})

describe('plugin directive handling', () => {
    test('fails when output file info is missing', () => {
        expect(() => plugin(
            schema,
            [],
            { prefix: '~tests/' },
            {} as never
        )).toThrow('Output file is missing')
    })

    test('fails early when an operation is missing a name', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query {
                            group {
                                owner {
                                    id
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow('Operation name is missing for query operation in "group.graphql:2:25". Name the operation so the plugin can generate stable declaration exports.')

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when operation names are duplicated in one document', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupDetails {
                            group {
                                owner {
                                    id
                                }
                            }
                        }

                        query GroupDetails {
                            group {
                                owner {
                                    id
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Duplicate operation name "GroupDetails" detected in "group\.graphql:\d+:\d+". The first definition is in "group\.graphql:\d+:\d+". Operation names must be unique within a document so the plugin can generate stable declaration exports\./)

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when operation variables are duplicated', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupDetails($id: ID!, $id: String) {
                            group {
                                owner {
                                    id
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Duplicate variable "\$id" detected in operation "GroupDetails" at "group\.graphql:\d+:\d+". The first definition is in "group\.graphql:\d+:\d+". Variable names must be unique within an operation\./)

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when a field argument is not defined by the schema', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupDetails($id: ID) {
                            group(id: $id) {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Unknown argument "id" detected on field "Query\.group" at "group\.graphql:\d+:\d+". Field arguments must match the GraphQL schema\./)

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when a field selection is not defined by the schema', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupDetails {
                            group {
                                missingField
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Unknown field "missingField" detected on type "Group" at "group\.graphql:\d+:\d+". Field selections must match the GraphQL schema\./)

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when a fragment type condition is not defined by the schema', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment MissingDetails on MissingType {
                            id
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Unknown fragment type "MissingType" detected at "group\.graphql:\d+:\d+". Fragment type conditions must reference types from the GraphQL schema\./)

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when an inline fragment type condition is not defined by the schema', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupDetails {
                            group {
                                ... on MissingType {
                                    id
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Unknown inline fragment type "MissingType" detected at "group\.graphql:\d+:\d+". Inline fragment type conditions must reference types from the GraphQL schema\./)

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when an operation root type is missing from the schema', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        mutation UpdateGroup {
                            __typename
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow('Root type for mutation operation "UpdateGroup" was not found in schema at "group.graphql:2:25". Add a mutation root type to the schema or remove the operation.')

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails early when a subscription root type is missing from the schema', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        subscription GroupUpdated {
                            __typename
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow('Root type for subscription operation "GroupUpdated" was not found in schema at "group.graphql:2:25". Add a subscription root type to the schema or remove the operation.')

            expect(existsSync(join(outputInfo.tempDir, 'schema.d.ts'))).toBe(false)
        })
    })

    test('fails when a non-typename field is aliased to __typename', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                __typename: id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow('Aliasing a field to "__typename" is not supported because this name is reserved')
        })
    })

    test('merges duplicate fields on the same nesting level', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('deduplicates repeated fragment spreads on the same nesting level', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment OwnerFields on User {
                            id
                        }

                        fragment GroupOwner on Group {
                            owner {
                                ...OwnerFields
                                ...OwnerFields
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: OwnerFields;`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('uses imported fragment type instead of duplicate output alias', async () => {
        const userSchema = buildSchema(`
            type Query {
                primaryUser: User!
                secondaryUser: User!
            }

            type User {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const usersQuery = `
                #import "./fragments.graphql"

                query UsersQuery {
                    primaryUser {
                        ...UserDetails
                    }

                    secondaryUser {
                        ...UserDetails
                    }
                }
            `
            const result = await plugin(
                userSchema,
                [{
                    location: 'fragments.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }
                    `),
                }, {
                    location: 'users.graphql',
                    rawSDL: usersQuery,
                    document: parse(usersQuery),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/users.graphql' {`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'\n`,
                `\timport type { UserDetails } from '~tests/fragments.graphql'\n`,
                `\texport type UsersQueryQueryVariables = { [key: string]: never }\n`,
                `\texport type UsersQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tprimaryUser: UserDetails;`,
                `\t\tsecondaryUser: UserDetails;`,
                `\t}\n`,
                `\texport const usersQueryQuery: TypedDocumentNode<UsersQueryQueryPayload, UsersQueryQueryVariables>\n`,
                `\texport default usersQueryQuery`,
                `}`,
            ].join('\n'))
        })
    })

    test('merges a sibling field returned from an inline fragment', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                                ... on User {
                                    id
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('keeps nested fields optional when only one repeated parent selection is conditional', async () => {
        const conditionalSchema = buildSchema(`
            type User {
                id: ID!
                name: String!
            }

            type Query {
                user: User!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                conditionalSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        query UserQuery($withId: Boolean!) {
                            user {
                                name
                            }

                            user @include(if: $withId) {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: {`,
                `\t\t\t__typename?: 'User';`,
                `\t\t\tname: string;`,
                `\t\t\tid?: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('fails when fields with the same response name target different source fields', async () => {
        await withTempOutput(async outputInfo => {
            expect(() => plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                name: id
                                ... on User {
                                    name: __typename
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )).toThrow(/Conflicting selections for response name "name" at "group\.graphql:\d+:\d+" and "group\.graphql:\d+:\d+": different target fields "id" and "__typename" cannot be merged\./)
        })
    })

    test('warns when a fragment spread has no matching definition in configured documents', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async ({ outputFile }) => {
            plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                ...MissingOwnerFields
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                { outputFile }
            )

            expect(warn).toHaveBeenCalledWith(expect.stringMatching(
                /Fragment definition "MissingOwnerFields" referenced from "group\.graphql:\d+:\d+" was not found among the documents configured for the plugin\./
            ))
        })

        warn.mockRestore()
    })

    test('warns when repeated fields and fragment spreads are merged from the same selection set', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async ({ outputFile }) => {
            plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment OwnerFields on User {
                            id
                        }

                        fragment GroupOwner on Group {
                            owner {
                                id
                                id
                                ...OwnerFields
                                ...OwnerFields
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                { outputFile }
            )

            expect(warn).toHaveBeenCalledWith(expect.stringMatching(
                /Repeated field selection "id" detected in fragment "GroupOwner" at "group\.graphql:\d+:\d+". The plugin merged it, but the selection is redundant. First occurrence: "group\.graphql:\d+:\d+"./
            ))
            expect(warn).toHaveBeenCalledWith(expect.stringMatching(
                /Repeated fragment spread "OwnerFields" detected in fragment "GroupOwner" at "group\.graphql:\d+:\d+". The plugin merged it, but the spread is redundant. First occurrence: "group\.graphql:\d+:\d+"./
            ))
        })

        warn.mockRestore()
    })

    test('warns when duplicate fragment definitions are declared in the same document', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async ({ outputFile }) => {
            plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                            }
                        }

                        fragment GroupOwner on Group {
                            owner {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                { outputFile }
            )

            expect(warn).toHaveBeenCalledWith(expect.stringMatching(
                /Duplicate fragment definition "GroupOwner" detected in "group\.graphql:\d+:\d+". Both definitions target type "Group". The plugin keeps the first definition from "group\.graphql:\d+:\d+" and ignores this duplicate./
            ))
        })

        warn.mockRestore()
    })

    test('does not warn about repeated fields when the second occurrence comes from an inline fragment', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async ({ outputFile }) => {
            plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                                ... on User {
                                    id
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                { outputFile }
            )

            expect(warn.mock.calls.some(([ message ]) =>
                typeof message === 'string' && message.includes('Repeated field selection "id"')
            )).toBe(false)
        })

        warn.mockRestore()
    })

    test('supports structured field override-type policies', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id @opaque
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        opaque: {
                            effect: 'override-type',
                            type: defineNamed('OpaqueId'),
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: OpaqueId;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('supports structured field nonnull policies', async () => {
        const nullableSchema = buildSchema(`
            type Query {
                user: User!
            }

            type User {
                nickname: String
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                nullableSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserNickname on User {
                            nickname @required
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        required: {
                            effect: 'nonnull',
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserNickname = {`,
                `\t\t__typename?: 'User';`,
                `\t\tnickname: string;`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('supports per-node directive policies', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id @mask
                                ... on UserPayload @mask {
                                    __typename
                                }
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        mask: {
                            field: {
                                effect: 'ignore',
                            },
                            inlineFragment: {
                                effect: 'conditional',
                            },
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('emits warnings for warn directive policies without changing shape', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id @review
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        review: {
                            effect: 'warn',
                            message: 'Directive "@review" needs manual verification',
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
            expect(warn).toHaveBeenCalledWith('Directive "@review" needs manual verification')
        })

        warn.mockRestore()
    })

    test('supports custom optional directive policies', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id @mask
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        mask: {
                            effect: 'conditional',
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid?: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('supports custom exclude directive policies', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                                ... on UserPayload @clientOnly {
                                    __typename
                                }
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        clientOnly: {
                            inlineFragment: {
                                effect: 'exclude',
                            },
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('ignores custom directives without shape policy', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id @trace
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    directivePolicies: {
                        trace: {
                            field: {
                                effect: 'ignore',
                            },
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('renders runtime-conditional directives as optional selections in plugin output', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        query GroupOwnerQuery($withTypeName: Boolean!) {
                            group {
                                ...GroupOwner
                            }
                        }

                        fragment GroupOwner on Group {
                            owner {
                                id
                                ... on UserPayload @include(if: $withTypeName) {
                                    __typename
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))

            expect(result).toContain([
                `\texport type GroupOwnerQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tgroup: GroupOwner;`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('prunes statically excluded selections from plugin output', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                                ... on UserPayload @include(if: false) {
                                    __typename
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
        })
    })
})

describe('plugin __typename support', () => {
    test('keeps explicit __typename selections in artifacts declarations', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                __typename
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
            ].join('\n'))
        })
    })

    test('uses possible runtime types for fragment root typename on interfaces', async () => {
        await withTempOutput(async outputInfo => {
            const result = await plugin(
                schema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserDetails = {`,
                `\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\tid: string;`,
            ].join('\n'))
        })
    })

    test('suppresses fallback typename for aliased __typename on concrete roots', async () => {
        const concreteSchema = buildSchema(`
            type Query {
                user: User!
            }

            type User {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                concreteSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserKind on User {
                            kind: __typename
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserKind = {`,
                `\t\tkind: 'User';`,
                `\t}`,
            ].join('\n'))
            expect(result).not.toContain(`\t\t__typename?: 'User';`)
        })
    })

    test('keeps distinct concrete shapes for interface fragments without explicit __typename', async () => {
        const polymorphicSchema = buildSchema(`
            type Query {
                user: User!
            }

            interface User {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
                permissions: [String!]!
            }

            type AdminPayload implements User {
                id: ID!
                role: String!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                polymorphicSchema,
                [{
                    location: 'polymorphic-user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                            ... on UserPayload {
                                permissions
                            }
                            ... on AdminPayload {
                                role
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserDetails = {`,
                `\t\t__typename?: 'UserPayload';`,
                `\t\tid: string;`,
                `\t\tpermissions: Array<string>;`,
                `\t} | {`,
                `\t\t__typename?: 'AdminPayload';`,
                `\t\tid: string;`,
                `\t\trole: string;`,
            ].join('\n'))
        })
    })

    test('keeps distinct concrete shapes for nested interface fields without explicit __typename', async () => {
        const polymorphicSchema = buildSchema(`
            type Query {
                group: Group!
            }

            interface User {
                id: ID!
            }

            type Group {
                owner: User!
            }

            type UserPayload implements User {
                id: ID!
                permissions: [String!]!
            }

            type AdminPayload implements User {
                id: ID!
                role: String!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                polymorphicSchema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupOwner on Group {
                            owner {
                                id
                                ... on UserPayload {
                                    permissions
                                }
                                ... on AdminPayload {
                                    role
                                }
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename: 'UserPayload';`,
                `\t\t\tid: string;`,
                `\t\t\tpermissions: Array<string>;`,
                `\t\t} | {`,
                `\t\t\t__typename: 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t\trole: string;`,
            ].join('\n'))
        })
    })

    test('omits duplicated root typename when the same typename comes from a root spread', async () => {
        const nestedSchema = buildSchema(`
            type Query {
                user: User!
            }

            interface User {
                id: ID!
                groups: [Group!]!
            }

            type Group {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
                groups: [Group!]!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                nestedSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }

                        fragment UserWithGroups on User {
                            ...UserDetails
                            groups {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserWithGroups = {`,
                `\t\tgroups: Array<{`,
                `\t\t\t__typename?: 'Group';`,
                `\t\t\tid: string;`,
                `\t\t}>;`,
                `\t} & UserDetails`,
            ].join('\n'))
        })
    })

    test('omits duplicated root typename for a spread imported from another document', async () => {
        const nestedSchema = buildSchema(`
            type Query {
                user: User!
            }

            interface User {
                id: ID!
                groups: [Group!]!
            }

            type Group {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
                groups: [Group!]!
            }
        `)

        await withTempOutput(async outputInfo => {
            const userWithGroups = `
                #import "./user-details.graphql"

                fragment UserWithGroups on User {
                    ...UserDetails
                    groups {
                        id
                    }
                }
            `
            const result = await plugin(
                nestedSchema,
                [{
                    location: 'user-details.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }
                    `),
                }, {
                    location: 'user-with-groups.graphql',
                    rawSDL: userWithGroups,
                    document: parse(userWithGroups),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/user-with-groups.graphql' {`,
                `\timport type { UserDetails } from '~tests/user-details.graphql'\n`,
                `\texport type UserWithGroups = {`,
                `\t\tgroups: Array<{`,
                `\t\t\t__typename?: 'Group';`,
                `\t\t\tid: string;`,
                `\t\t}>;`,
                `\t} & UserDetails`,
                `}`,
            ].join('\n'))
        })
    })

    test('omits duplicated root typename when object fields are intersected with two root spreads sharing the same typename union', async () => {
        const nestedSchema = buildSchema(`
            type Query {
                user: User!
            }

            interface User {
                id: ID!
                isOnline: Boolean!
                groups: [Group!]!
            }

            type Group {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
                isOnline: Boolean!
                groups: [Group!]!
            }

            type AdminPayload implements User {
                id: ID!
                isOnline: Boolean!
                groups: [Group!]!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                nestedSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }

                        fragment UserPresence on User {
                            isOnline
                        }

                        fragment UserWithGroups on User {
                            ...UserDetails
                            ...UserPresence
                            groups {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserWithGroups = {`,
                `\t\tgroups: Array<{`,
                `\t\t\t__typename?: 'Group';`,
                `\t\t\tid: string;`,
                `\t\t}>;`,
                `\t} & UserDetails & UserPresence`,
            ].join('\n'))
        })
    })

    test('keeps root typename when object fields are intersected with two root spreads having different typename unions', async () => {
        const nestedSchema = buildSchema(`
            type Query {
                user: User!
            }

            interface User {
                id: ID!
                groups: [Group!]!
            }

            interface Presence {
                isOnline: Boolean!
            }

            type Group {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
                groups: [Group!]!
            }

            type AdminPayload implements User & Presence {
                id: ID!
                isOnline: Boolean!
                groups: [Group!]!
            }

            type ModeratorPayload implements Presence {
                isOnline: Boolean!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                nestedSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }

                        fragment UserPresence on Presence {
                            isOnline
                        }

                        fragment UserWithGroups on User {
                            ...UserDetails
                            ...UserPresence
                            groups {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type UserWithGroups = {`,
                `\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\tgroups: Array<{`,
                `\t\t\t__typename?: 'Group';`,
                `\t\t\tid: string;`,
                `\t\t}>;`,
                `\t} & UserDetails & UserPresence`,
            ].join('\n'))
        })
    })

    test('renders graphql operations as typed document declarations', async () => {
        const operationSchema = buildSchema(`
            type Query {
                user(id: ID!): User
            }

            type User {
                id: ID!
                username: String!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                operationSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        query UserQuery($id: ID!) {
                            user(id: $id) {
                                id
                                username
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain(`\timport type { Exact } from './schema'`)
            expect(result).toContain([
                `\texport type UserQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: {`,
                `\t\t\t__typename?: 'User';`,
                `\t\t\tid: string;`,
                `\t\t\tusername: string;`,
                `\t\t} | null;`,
            ].join('\n'))
            expect(result).toContain([
                `\texport type UserQueryQueryVariables = Exact<{`,
                `\t\tid: string;`,
                `\t}>`,
            ].join('\n'))
            expect(result).toContain(`\texport const userQueryQuery: TypedDocumentNode<UserQueryQueryPayload, UserQueryQueryVariables>`)
            expect(result).toContain(`\texport default userQueryQuery`)
        })
    })

    test('renders recursive input objects through named aliases instead of infinitely expanding them', async () => {
        const recursiveInputSchema = buildSchema(`
            input TreeInput {
                value: String
                children: [TreeInput!]
            }

            type Mutation {
                createTree(input: TreeInput!): Boolean!
            }

            type Query {
                _: Boolean!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                recursiveInputSchema,
                [{
                    location: 'tree.graphql',
                    document: parse(`
                        mutation CreateTree($input: TreeInput!) {
                            createTree(input: $input)
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/tree.graphql' {`,
                `\timport type { Exact } from './schema'\n`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'\n`,
                `\ttype TreeInputAlias = {`,
                `\t\tvalue?: string | null;`,
                `\t\tchildren?: Array<TreeInputAlias> | null;`,
                `\t}`,
            ].join('\n'))
            expect(result).toContain([
                `\texport type CreateTreeMutationVariables = Exact<{`,
                `\t\tinput: TreeInputAlias;`,
                `\t}>`,
            ].join('\n'))
        })
    })

    test('writes schema.d.ts and enums.ts next to the generated declarations and imports enums from enums file', async () => {
        const enumSchema = buildSchema(`
            scalar DateTime

            type Query {
                group: Group!
            }

            type Group {
                permission: Permission!
                createdAt: DateTime!
            }

            enum Permission {
                GroupCreate
                GroupEdit
            }
        `)

        await withTempOutput(async ({ outputFile, tempDir }) => {
            const result = await plugin(
                enumSchema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupDetails on Group {
                            permission
                            createdAt
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scalars: {
                        DateTime: {
                            input: defineString(),
                            output: defineString(),
                        },
                    },
                },
                { outputFile }
            )

            expect(result).toContain(`import type { Permission } from './enums'`)

            expect(readFileSync(join(tempDir, 'schema.d.ts'), 'utf8')).toBe(
                [
                    `import type { Permission } from './enums'\n`,
                    SCHEMA_HELPER_DECLARATIONS + '\n',
                    'export type Scalars = {',
                    '\tDateTime: { input: string; output: string; };',
                    '}\n',
                    'export type Group = {',
                    `\t__typename?: 'Group';`,
                    `\tpermission: Permission;`,
                    `\t/** @remarks Scalar reference: \`Scalars['DateTime']['output']\`. */`,
                    `\tcreatedAt: string;`,
                    '}\n',
                    'export type Query = {',
                    `\t__typename?: 'Query';`,
                    `\tgroup: Group;`,
                    '}',
                ].join('\n')
            )

            expect(readFileSync(join(tempDir, 'enums.ts'), 'utf8')).toBe(
                [
                    'export enum Permission {',
                    `\tGroupCreate = 'GroupCreate',`,
                    `\tGroupEdit = 'GroupEdit',`,
                    '}',
                ].join('\n')
            )
        })
    })

    test('writes enums to a configured schema directory and imports enums from it', async () => {
        const enumSchema = buildSchema(`
            type Query {
                group: Group!
            }

            type Group {
                permission: Permission!
            }

            enum Permission {
                GroupCreate
                GroupEdit
            }
        `)

        await withTempOutput(async ({ outputFile, tempDir }) => {
            const result = await plugin(
                enumSchema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupDetails on Group {
                            permission
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    schemaOutputDirectory: 'generated/schema',
                },
                { outputFile }
            )

            expect(result).toContain(`import type { Permission } from './generated/schema/enums'`)

            expect(existsSync(join(tempDir, 'schema.d.ts'))).toBe(false)
            expect(existsSync(join(tempDir, 'enums.ts'))).toBe(false)

            expect(readFileSync(join(tempDir, 'generated/schema/schema.d.ts'), 'utf8')).toBe(
                [
                    `import type { Permission } from './enums'\n`,
                    SCHEMA_HELPER_DECLARATIONS + '\n',
                    'export type Group = {',
                    `\t__typename?: 'Group';`,
                    `\tpermission: Permission;`,
                    '}\n',
                    'export type Query = {',
                    `\t__typename?: 'Query';`,
                    `\tgroup: Group;`,
                    '}',
                ].join('\n')
            )
            expect(readFileSync(join(tempDir, 'generated/schema/enums.ts'), 'utf8')).toBe(
                [
                    'export enum Permission {',
                    `\tGroupCreate = 'GroupCreate',`,
                    `\tGroupEdit = 'GroupEdit',`,
                    '}',
                ].join('\n')
            )
        })
    })

    test('does not write enums file when no enums are registered', async () => {
        const scalarSchema = buildSchema(`
            scalar DateTime

            type Query {
                user: User!
            }

            type User {
                createdAt: DateTime!
            }
        `)

        await withTempOutput(async ({ outputFile, tempDir }) => {
            await plugin(
                scalarSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            createdAt
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scalars: {
                        DateTime: {
                            input: defineString(),
                            output: defineString(),
                        },
                    },
                },
                { outputFile }
            )

            expect(readFileSync(join(tempDir, 'schema.d.ts'), 'utf8')).toBe(
                [
                    SCHEMA_HELPER_DECLARATIONS + '\n',
                    'export type Scalars = {',
                    '\tDateTime: { input: string; output: string; };',
                    '}\n',
                    'export type Query = {',
                    `\t__typename?: 'Query';`,
                    `\tuser: User;`,
                    '}\n',
                    'export type User = {',
                    `\t__typename?: 'User';`,
                    `\t/** @remarks Scalar reference: \`Scalars['DateTime']['output']\`. */`,
                    `\tcreatedAt: string;`,
                    '}',
                ].join('\n')
            )
            expect(existsSync(join(tempDir, 'enums.ts'))).toBe(false)
        })
    })

    test('writes schema file for enum-backed schema object types', async () => {
        const enumSchema = buildSchema(`
            type Query {
                group: Group!
            }

            type Group {
                permission: Permission!
            }

            enum Permission {
                GroupCreate
                GroupEdit
            }
        `)

        await withTempOutput(async ({ outputFile, tempDir }) => {
            await plugin(
                enumSchema,
                [{
                    location: 'group.graphql',
                    document: parse(`
                        fragment GroupDetails on Group {
                            permission
                        }
                    `),
                }],
                { prefix: '~tests/' },
                { outputFile }
            )

            expect(readFileSync(join(tempDir, 'schema.d.ts'), 'utf8')).toBe(
                [
                    `import type { Permission } from './enums'\n`,
                    SCHEMA_HELPER_DECLARATIONS + '\n',
                    'export type Group = {',
                    `\t__typename?: 'Group';`,
                    `\tpermission: Permission;`,
                    '}\n',
                    'export type Query = {',
                    `\t__typename?: 'Query';`,
                    `\tgroup: Group;`,
                    '}',
                ].join('\n')
            )
            expect(readFileSync(join(tempDir, 'enums.ts'), 'utf8')).toBe(
                [
                    'export enum Permission {',
                    `\tGroupCreate = 'GroupCreate',`,
                    `\tGroupEdit = 'GroupEdit',`,
                    '}',
                ].join('\n')
            )
        })
    })

    test('renders nullable custom scalar unions without duplicating null', async () => {
        const scalarSchema = buildSchema(`
            scalar DateTime

            type Query {
                user: User!
            }

            type User {
                createdAt: DateTime
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                scalarSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDates on User {
                            createdAt
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scalars: {
                        DateTime: {
                            output: unionOf(defineNamed('Date'), defineNull()),
                        },
                    },
                },
                outputInfo
            )

            expect(result).toContain([
                '\texport type UserDates = {',
                `\t\t__typename?: 'User';`,
                '\t\tcreatedAt: Date | null;',
                '\t}',
            ].join('\n'))
        })
    })

    test('does not import Exact for fragment-only output', async () => {
        const fragmentSchema = buildSchema(`
            type Query {
                user: User!
            }

            type User {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                fragmentSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).not.toContain('import type { Exact }')
            expect(result).not.toContain('type Exact<T extends')
        })
    })

    test('does not import Exact for operations without variables', async () => {
        const operationSchema = buildSchema(`
            type Query {
                users: [User!]!
            }

            type User {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                operationSchema,
                [{
                    location: 'users.graphql',
                    document: parse(`
                        query UsersList {
                            users {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain(`\texport type UsersListQueryVariables = { [key: string]: never }`)
            expect(result).not.toContain('Exact<{ [key: string]: never }>')
        })
    })
})

describe('plugin operation output', () => {
    test('renders typed document declarations for subscriptions', async () => {
        const subscriptionSchema = buildSchema(`
            type Query {
                healthcheck: String!
            }

            type Subscription {
                groupUpdated: Group!
            }

            type Group {
                id: ID!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                subscriptionSchema,
                [{
                    location: 'group-updated.graphql',
                    document: parse(`
                        subscription GroupUpdated {
                            groupUpdated {
                                id
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `\texport type GroupUpdatedSubscriptionPayload = {`,
                `\t\t__typename?: 'Subscription';`,
                `\t\tgroupUpdated: {`,
                `\t\t\t__typename?: 'Group';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
            expect(result).toContain(
                `\texport const groupUpdatedSubscription: TypedDocumentNode<GroupUpdatedSubscriptionPayload, GroupUpdatedSubscriptionVariables>`
            )
            expect(result).toContain(`\texport default groupUpdatedSubscription`)
        })
    })
})

describe('plugin multi-definition documents', () => {
    test('renders multiple fragments from the same document', async () => {
        const multiFragmentSchema = buildSchema(`
            type Query {
                user: User!
            }

            type User {
                id: ID!
                username: String!
                email: String
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                multiFragmentSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserIdentity on User {
                            id
                        }

                        fragment UserContact on User {
                            username
                            email
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/user.graphql' {`,
                `\texport type UserIdentity = {`,
                `\t\t__typename?: 'User';`,
                `\t\tid: string;`,
                `\t}\n`,
                `\texport type UserContact = {`,
                `\t\t__typename?: 'User';`,
                `\t\tusername: string;`,
                `\t\temail: string | null;`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('renders multiple operations from the same document', async () => {
        const multiOperationSchema = buildSchema(`
            type Query {
                user(id: ID!): User
                users: [User!]!
            }

            type User {
                id: ID!
                username: String!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                multiOperationSchema,
                [{
                    location: 'users.graphql',
                    document: parse(`
                        query UserById($id: ID!) {
                            user(id: $id) {
                                id
                            }
                        }

                        query UsersList {
                            users {
                                username
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/users.graphql' {`,
                `\timport type { Exact } from './schema'\n`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'`,
            ].join('\n'))

            expect(result).toContain([
                `\texport type UserByIdQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: {`,
                `\t\t\t__typename?: 'User';`,
                `\t\t\tid: string;`,
                `\t\t} | null;`,
                `\t}`,
            ].join('\n'))

            expect(result).toContain([
                `\texport type UsersListQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tusers: Array<{`,
                `\t\t\t__typename?: 'User';`,
                `\t\t\tusername: string;`,
                `\t\t}>;`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('renders operations and fragments together from the same document', async () => {
        const mixedSchema = buildSchema(`
            type Query {
                user(id: ID!): User
            }

            type User {
                id: ID!
                username: String!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                mixedSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment UserFields on User {
                            id
                            username
                        }

                        query UserQuery($id: ID!) {
                            user(id: $id) {
                                ...UserFields
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/user.graphql' {`,
                `\timport type { Exact } from './schema'\n`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'\n`,
                `\texport type UserFields = {`,
                `\t\t__typename?: 'User';`,
                `\t\tid: string;`,
                `\t\tusername: string;`,
                `\t}`,
            ].join('\n'))
            expect(result).toContain([
                `\texport type UserQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: UserFields | null;`,
                `\t}`,
            ].join('\n'))
        })
    })

    test('renders duplicate fragment names from different documents as separate module declarations', async () => {
        const duplicateFragmentSchema = buildSchema(`
            type Query {
                user: User!
                group: Group!
            }

            type User {
                id: ID!
                username: String!
            }

            type Group {
                id: ID!
                title: String!
            }
        `)

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                duplicateFragmentSchema,
                [{
                    location: 'user.graphql',
                    document: parse(`
                        fragment SharedDetails on User {
                            id
                            username
                        }
                    `),
                }, {
                    location: 'group.graphql',
                    document: parse(`
                        fragment SharedDetails on Group {
                            id
                            title
                        }

                        query GroupDetails {
                            group {
                                ...SharedDetails
                            }
                        }
                    `),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain([
                `declare module '~tests/user.graphql' {`,
                `\texport type SharedDetails = {`,
                `\t\t__typename?: 'User';`,
                `\t\tid: string;`,
                `\t\tusername: string;`,
                `\t}`,
                `}`,
            ].join('\n'))
            expect(result).toContain([
                `declare module '~tests/group.graphql' {`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'\n`,
                `\texport type SharedDetails = {`,
                `\t\t__typename?: 'Group';`,
                `\t\tid: string;`,
                `\t\ttitle: string;`,
                `\t}`,
            ].join('\n'))
            expect(result).toContain([
                `\texport type GroupDetailsQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tgroup: SharedDetails;`,
                `\t}`,
            ].join('\n'))
            expect(result).not.toContain(`import type { SharedDetails } from '~tests/user.graphql'`)
        })
    })

    test('fails when different document locations resolve to the same declaration module', async () => {
        const collisionSchema = buildSchema(`
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
            expect(() => plugin(
                collisionSchema,
                [{
                    location: 'queries/shared.graphql',
                    document: parse(`
                        query UserQuery {
                            user {
                                id
                            }
                        }
                    `),
                }, {
                    location: 'mutations/shared.graphql',
                    document: parse(`
                        query GroupQuery {
                            group {
                                id
                            }
                        }
                    `),
                }],
                {
                    prefix: '~tests/',
                    scope: 'shared.graphql',
                },
                outputInfo
            )).toThrow('Document module specifier collision detected: "queries/shared.graphql" and "mutations/shared.graphql" both resolve to "~tests/shared.graphql". Adjust the plugin prefix, scope, or document locations so each generated declaration module is unique.')
        })
    })

    test('uses the imported fragment source when duplicate external fragment names exist', async () => {
        const duplicateFragmentSchema = buildSchema(`
            type Query {
                group: Group!
            }

            type User {
                id: ID!
                username: String!
            }

            type Group {
                id: ID!
                title: String!
            }
        `)
        const groupQuery = `
            #import "../fragments/group.graphql"

            query GroupDetails {
                group {
                    ...SharedDetails
                }
            }
        `

        await withTempOutput(async outputInfo => {
            const result = await plugin(
                duplicateFragmentSchema,
                [{
                    location: 'fragments/user.graphql',
                    document: parse(`
                        fragment SharedDetails on User {
                            id
                            username
                        }
                    `),
                }, {
                    location: 'fragments/group.graphql',
                    document: parse(`
                        fragment SharedDetails on Group {
                            id
                            title
                        }
                    `),
                }, {
                    location: 'queries/group.graphql',
                    rawSDL: groupQuery,
                    document: parse(groupQuery),
                }],
                { prefix: '~tests/' },
                outputInfo
            )

            expect(result).toContain(`\timport type { SharedDetails } from '~tests/fragments/group.graphql'`)
            expect(result).not.toContain(`\timport type { SharedDetails } from '~tests/fragments/user.graphql'`)

            expect(result).toContain([
                `\texport type GroupDetailsQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tgroup: SharedDetails;`,
                `\t}`,
            ].join('\n'))
        })
    })
})
