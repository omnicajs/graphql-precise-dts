import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { buildSchema } from 'graphql'
import { join } from 'path'
import { mkdtempSync } from 'fs'
import { parse } from 'graphql'
import { plugin } from '../../src'
import {
    readFileSync,
    rmSync,
} from 'fs'
import { tmpdir } from 'os'

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

describe('plugin __typename support', () => {
    test('supports structured field override-type policies', async () => {
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
                        field: {
                            effect: 'override-type',
                            type: 'OpaqueId',
                        },
                    },
                },
            },
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid: OpaqueId;`)
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
                        field: {
                            effect: 'nonnull',
                        },
                    },
                },
            },
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\tnickname: string;`)
        expect(result.content).not.toContain(`\t\tnickname: string | null;`)
    })

    test('supports per-node directive policies', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid: string;`)
        expect(result.content).toContain(`\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`)
        expect(result.content).not.toContain(`\t\t\t__typename?: 'UserPayload';`)
    })

    test('emits warnings for warn directive policies without changing shape', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

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
                        field: {
                            effect: 'warn',
                            message: 'Directive "@review" needs manual verification',
                        },
                    },
                },
            },
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid: string;`)
        expect(warn).toHaveBeenCalledWith('Directive "@review" needs manual verification')
        warn.mockRestore()
    })

    test('supports custom optional directive policies', async () => {
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
                        field: {
                            effect: 'conditional',
                        },
                    },
                },
            },
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid?: string;`)
    })

    test('supports custom exclude directive policies', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid: string;`)
        expect(result.content).not.toContain(`\t\t\t__typename?: 'UserPayload';`)
    })

    test('ignores custom directives without shape policy', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid: string;`)
        expect(result.content).not.toContain(`\t\t\tid?: string;`)
    })

    test('renders runtime-conditional directives as optional selections in plugin output', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `\t\towner: {`,
            `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
            `\t\t\tid: string;`,
        ].join('\n'))
        expect(result.content).not.toContain(`\t\t\t__typename?: 'UserPayload';`)
    })

    test('prunes statically excluded selections from plugin output', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\t\t\tid: string;`)
        expect(result.content).not.toContain(`\t\t\t__typename?: 'UserPayload';`)
    })

    test('keeps explicit __typename selections in artifacts declarations', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `\t\t__typename?: 'Group';`,
            `\t\towner: {`,
            `\t\t\t__typename: 'UserPayload';`,
            `\t\t\tid: string;`,
            `\t\t} | {`,
            `\t\t\t__typename: 'AdminPayload';`,
            `\t\t\tid: string;`,
        ].join('\n'))
    })

    test('uses possible runtime types for fragment root typename on interfaces', async () => {
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `\texport type UserDetails = {`,
            `\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
            `\t\tid: string;`,
        ].join('\n'))
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `\texport type UserWithGroups = {`,
            `\t\tgroups: Array<{`,
            `\t\t\t__typename?: 'Group';`,
            `\t\t\tid: string;`,
            `\t\t}>;`,
            `\t} & UserDetails`,
        ].join('\n'))
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
                document: parse(`
                    fragment UserWithGroups on User {
                        ...UserDetails
                        groups {
                            id
                        }
                    }
                `),
            }],
            { prefix: '~tests/' },
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `declare module '~tests/user-with-groups.graphql' {`,
            `\timport type { UserDetails } from '~tests/user-details.graphql'`,
            ``,
            `\texport type UserWithGroups = {`,
            `\t\tgroups: Array<{`,
            `\t\t\t__typename?: 'Group';`,
            `\t\t\tid: string;`,
            `\t\t}>;`,
            `\t} & UserDetails`,
            `}`,
        ].join('\n'))
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `\texport type UserWithGroups = {`,
            `\t\tgroups: Array<{`,
            `\t\t\t__typename?: 'Group';`,
            `\t\t\tid: string;`,
            `\t\t}>;`,
            `\t} & UserDetails & UserPresence`,
        ].join('\n'))
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain([
            `\texport type UserWithGroups = {`,
            `\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
            `\t\tgroups: Array<{`,
            `\t\t\t__typename?: 'Group';`,
            `\t\t\tid: string;`,
            `\t\t}>;`,
            `\t} & UserDetails & UserPresence`,
        ].join('\n'))
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
            { outputFile: 'types.d.ts' }
        )

        expect(result.content).toContain(`\texport type UserQueryQuery = {`)
        expect(result.content).toContain(`\t\t__typename?: 'Query';`)
        expect(result.content).toContain(`\t\tuser: {`)
        expect(result.content).toContain(`\texport type UserQueryQueryVariables = Exact<{`)
        expect(result.content).toContain(`\t\tid: string`)
        expect(result.content).toContain(`\texport const userQueryQuery: TypedDocumentNode<UserQueryQuery, UserQueryQueryVariables>`)
        expect(result.content).toContain(`\texport default userQueryQuery`)
    })

    test('writes schema.d.ts next to the generated declarations and imports enums from it', async () => {
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

        const tempDir = mkdtempSync(join(tmpdir(), 'graphql-typed-declaration-'))
        const outputFile = join(tempDir, 'types.d.ts')

        try {
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
                            input: 'string',
                            output: 'string',
                        },
                    },
                },
                { outputFile }
            )

            expect(result.content).toContain(`import type { Permission } from './schema'`)
            expect(readFileSync(join(tempDir, 'schema.d.ts'), 'utf8')).toBe(
                [
                    'export type Scalars = {',
                    '    DateTime: { input: string; output: string; };',
                    '};',
                    '',
                    `export type Permission = 'GroupCreate' | 'GroupEdit'`,
                ].join('\n')
            )
        } finally {
            rmSync(tempDir, { recursive: true, force: true })
        }
    })
})
