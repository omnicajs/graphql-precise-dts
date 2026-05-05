import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { join } from 'path'
import { readFileSync } from 'fs'
import { withTempOutput } from './utils/temp-output'
import {
    defineNamed,
    defineNull,
    defineString,
    plugin,
    unionOf,
} from '../../src'

import {
    buildSchema,
    parse,
} from 'graphql'

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

describe('plugin directive handling', () => {
    test('fails when output file info is missing', () => {
        expect(() => plugin(
            schema,
            [],
            { prefix: '~tests/' },
            {} as never
        )).toThrow('Output file is missing')
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: OwnerFields;`,
                `\t}`,
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
                `\texport type GroupOwner = {`,
                `\t\t__typename?: 'Group';`,
                `\t\towner: {`,
                `\t\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
                `\texport type UserKind = {`,
                `\t\tkind: 'User';`,
                `\t}`,
            ].join('\n'))
            expect(result.content).not.toContain(`\t\t__typename?: 'User';`)
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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
                outputInfo
            )

            expect(result.content).toContain([
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

            expect(result.content).toContain([
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

            expect(result.prepend).toEqual([
                'type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }\n',
            ])
            expect(result.content).toContain([
                `\texport type UserQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: {`,
                `\t\t\t__typename?: 'User';`,
                `\t\t\tid: string;`,
                `\t\t\tusername: string;`,
                `\t\t} | null;`,
            ].join('\n'))
            expect(result.content).toContain([
                `\texport type UserQueryQueryVariables = Exact<{`,
                `\t\tid: string;`,
                `\t}>`,
            ].join('\n'))
            expect(result.content).toContain(`\texport const userQueryQuery: TypedDocumentNode<UserQueryQueryPayload, UserQueryQueryVariables>`)
            expect(result.content).toContain(`\texport default userQueryQuery`)
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

            expect(result.content).toContain([
                `declare module '~tests/tree.graphql' {`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'\n`,
                `\texport type TreeInput = {`,
                `\t\tvalue?: string | null;`,
                `\t\tchildren?: Array<TreeInput> | null;`,
                `\t}`,
            ].join('\n'))
            expect(result.content).toContain([
                `\texport type CreateTreeMutationVariables = Exact<{`,
                `\t\tinput: TreeInput;`,
                `\t}>`,
            ].join('\n'))
        })
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

            expect(result.content).toContain(`import type { Permission } from './schema'`)

            expect(readFileSync(join(tempDir, 'schema.d.ts'), 'utf8')).toBe(
                [
                    'export type Scalars = {',
                    '\tDateTime: { input: string; output: string; };',
                    '};\n',
                    `export type Permission = 'GroupCreate' | 'GroupEdit'`,
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

            expect(result.content).toContain([
                '\texport type UserDates = {',
                `\t\t__typename?: 'User';`,
                '\t\tcreatedAt: Date | null;',
                '\t}',
            ].join('\n'))
        })
    })

    test('does not prepend Exact for fragment-only output', async () => {
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

            expect(result.prepend).toEqual([])
        })
    })

    test('does not prepend Exact for operations without variables', async () => {
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

            expect(result.prepend).toEqual([])
            expect(result.content).toContain(`\texport type UsersListQueryVariables = { [key: string]: never }`)
            expect(result.content).not.toContain('Exact<{ [key: string]: never }>')
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

            expect(result.content).toContain([
                `\texport type GroupUpdatedSubscriptionPayload = {`,
                `\t\t__typename?: 'Subscription';`,
                `\t\tgroupUpdated: {`,
                `\t\t\t__typename?: 'Group';`,
                `\t\t\tid: string;`,
                `\t\t};`,
                `\t}`,
            ].join('\n'))
            expect(result.content).toContain(
                `\texport const groupUpdatedSubscription: TypedDocumentNode<GroupUpdatedSubscriptionPayload, GroupUpdatedSubscriptionVariables>`
            )
            expect(result.content).toContain(`\texport default groupUpdatedSubscription`)
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

            expect(result.content).toContain([
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

            expect(result.content).toContain([
                `declare module '~tests/users.graphql' {`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'`,
            ].join('\n'))

            expect(result.content).toContain([
                `\texport type UserByIdQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: {`,
                `\t\t\t__typename?: 'User';`,
                `\t\t\tid: string;`,
                `\t\t} | null;`,
                `\t}`,
            ].join('\n'))

            expect(result.content).toContain([
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

            expect(result.content).toContain([
                `declare module '~tests/user.graphql' {`,
                `\timport type { TypedDocumentNode } from '@graphql-typed-document-node/core'\n`,
                `\timport type { UserFields } from '~tests/user.graphql'\n`,
                `\texport type UserFields = {`,
                `\t\t__typename?: 'User';`,
                `\t\tid: string;`,
                `\t\tusername: string;`,
                `\t}`,
            ].join('\n'))
            expect(result.content).toContain([
                `\texport type UserQueryQueryPayload = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: UserFields | null;`,
                `\t}`,
            ].join('\n'))
        })
    })
})
