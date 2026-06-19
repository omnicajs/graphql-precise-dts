import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildGenerationModels } from '../../../src/models/generation-builder'
import { buildSchema } from 'graphql'
import { defineNamed } from '../../../src'
import { makeTestModelContext } from '../helpers/model-context'
import { parse } from 'graphql'
import { renderType } from '../../../src'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'

describe('generation builder', () => {
    test('builds input type models from GraphQL schema types', () => {
        const schema = buildSchema(`
            input UserFilter {
                status: String
            }

            type Query {
                users(filter: UserFilter): [String!]!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.inputTypes.get('UserFilter')).not.toBeUndefined()
        expect(renderType(schemaOutput.inputTypes.get('UserFilter')!)).toBe([
            '{',
            `\t/** @remarks Scalar reference: \`Scalars['String']['input']\`. */`,
            `\tstatus?: string | null;`,
            '}',
        ].join('\n'))
    })

    test('keeps raw GraphQL names in schema output models', () => {
        const schema = buildSchema(`
            schema {
                query: query_root
            }

            enum user_status {
                IS_ACTIVE
            }

            input user_filter {
                user_status: user_status
            }

            type user_profile {
                user_id: ID!
                status: user_status!
            }

            type query_root {
                user_profile(filter_by: user_filter): user_profile
            }
        `)

        const { schema: schemaOutput, registry } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect([ ...schemaOutput.inputTypes.keys() ]).toContain('user_filter')
        expect([ ...schemaOutput.objectTypes.keys() ]).toContain('user_profile')
        expect([ ...schemaOutput.objectTypes.keys() ]).toContain('query_root')
        expect(schemaOutput.fieldArgTypes).toEqual(expect.arrayContaining([
            expect.objectContaining({
                parentTypeName: 'query_root',
                fieldName: 'user_profile',
            }),
        ]))
        expect(schemaOutput.enumReferences).toContain('user_status')
        expect(registry.enums.get('user_status')?.entries).toEqual([
            { name: 'IS_ACTIVE', value: 'IS_ACTIVE' },
        ])
    })

    test('keeps raw enum names in registry models', () => {
        const schema = buildSchema(`
            enum user_status {
                IS_ACTIVE
            }

            type Query {
                status: user_status!
            }
        `)

        const { registry } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(registry.enums.get('user_status')?.entries).toEqual([
            { name: 'IS_ACTIVE', value: 'IS_ACTIVE' },
        ])
    })

    test('builds interface models from GraphQL schema types', () => {
        const schema = buildSchema(`
            interface Node {
                id: ID!
            }

            type User implements Node {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.interfaceTypes.get('Node')).not.toBeUndefined()
        expect(renderType(schemaOutput.interfaceTypes.get('Node')!)).toBe([
            '{',
            `\t/** @remarks Scalar reference: \`Scalars['ID']['output']\`. */`,
            `\tid: string;`,
            '}',
        ].join('\n'))
    })

    test('tracks implemented interfaces on object models', () => {
        const schema = buildSchema(`
            interface Node {
                id: ID!
            }

            type User implements Node {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.objectTypes.get('User')).not.toBeUndefined()
        expect(schemaOutput.objectTypes.get('User')?.interfaces).toEqual([ 'Node' ])
    })

    test('builds union models from GraphQL schema types', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Group {
                id: ID!
            }

            union SearchResult = User | Group

            type Query {
                search: SearchResult!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.unionTypes.get('SearchResult')).not.toBeUndefined()
        expect(renderType(schemaOutput.unionTypes.get('SearchResult')!)).toBe('User | Group')
    })

    test('keeps GraphQL union descriptions in schema output models', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Group {
                id: ID!
            }

            "Search result item."
            union SearchResult = User | Group

            type Query {
                search: SearchResult!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.unionTypes.get('SearchResult')).toMatchObject({
            description: 'Search result item.',
        })
    })

    test('builds field argument models from GraphQL schema types', () => {
        const schema = buildSchema(`
            input UserFilter {
                status: String
            }

            type User {
                id: ID!
            }

            type Query {
                user(id: ID!, filter: UserFilter): User
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        const fieldArgType = schemaOutput.fieldArgTypes.find(model =>
            model.parentTypeName === 'Query' && model.fieldName === 'user'
        )

        expect(fieldArgType).not.toBeUndefined()
        expect(renderType(fieldArgType!.type)).toBe([
            '{',
            `\t/** @remarks Scalar reference: \`Scalars['ID']['input']\`. */`,
            `\tid: string;`,
            `\tfilter?: UserFilter | null;`,
            '}',
        ].join('\n'))
    })

    test('collects enum references and registry enum models from GraphQL schema types', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            type User {
                status: UserStatus!
            }

            type Query {
                user: User
            }
        `)

        const { schema: schemaOutput, registry } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.enumReferences).toEqual(new Set([ 'UserStatus' ]))

        expect(registry.enums.get('UserStatus')).toEqual({
            entries: [
                { name: 'ACTIVE', value: 'ACTIVE' },
                { name: 'BLOCKED', value: 'BLOCKED' },
            ],
        })
    })

    test('does not collect enum references from custom scalar TypeScript names', () => {
        const schema = buildSchema(`
            scalar DateTime

            enum Permission {
                GroupCreate
            }

            type Query {
                createdAt: DateTime!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema }),
            { DateTime: defineNamed('Permission') }
        )

        expect(schemaOutput.objectTypes.get('Query')).not.toBeUndefined()
        expect(renderType(schemaOutput.objectTypes.get('Query')!.fields)).toContain(`createdAt: Permission;`)

        expect(schemaOutput.enumReferences).toEqual(new Set())
    })

    test('uses unknown for unmapped custom scalar schema references', () => {
        const schema = buildSchema(`
            scalar DateTime

            type Query {
                createdAt: DateTime!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.objectTypes.get('Query')).not.toBeUndefined()

        expect(renderType(schemaOutput.objectTypes.get('Query')!.fields)).toContain('createdAt: unknown;')
    })

    test('keeps GraphQL scalar descriptions in schema output models', () => {
        const schema = buildSchema(`
            "ISO date-time string."
            scalar DateTime @specifiedBy(url: "https://scalars.graphql.org/andimarek/date-time.html")

            type Query {
                createdAt: DateTime!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema }),
            { DateTime: defineNamed('Date') }
        )

        expect(schemaOutput.scalars.get('DateTime')).toMatchObject({
            input: 'Date',
            output: 'Date',
            description: 'ISO date-time string.',
            specifiedByUrl: 'https://scalars.graphql.org/andimarek/date-time.html',
        })
    })

    test('ignores custom scalar mappings that do not match schema scalar types', () => {
        const schema = buildSchema(`
            scalar DateTime

            enum Permission {
                READ
            }

            type Query {
                createdAt: DateTime!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema }),
            {
                DateTime: defineNamed('Date'),
                MissingScalar: defineNamed('MissingScalar'),
                Permission: defineNamed('PermissionValue'),
            }
        )

        expect(schemaOutput.scalars.get('DateTime')).toEqual({
            input: 'Date',
            output: 'Date',
        })
        expect(schemaOutput.scalars.has('MissingScalar')).toBe(false)
        expect(schemaOutput.scalars.has('Permission')).toBe(false)
    })

    test('keeps GraphQL input type and field descriptions in schema output models', () => {
        const schema = buildSchema(`
            "User search filters."
            input UserFilter {
                "Input field UserFilter.status filters users by legacy status."
                status: String @deprecated(reason: "Use active instead")
            }

            type Query {
                users(filter: UserFilter): [String!]!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.inputTypes.get('UserFilter')).toMatchObject({
            description: 'User search filters.',
            kind: 'object',
            fields: [
                {
                    name: 'status',
                    description: 'Input field UserFilter.status filters users by legacy status.',
                    deprecationReason: 'Use active instead',
                    remarks: 'Scalar reference: `Scalars[\'String\'][\'input\']`.',
                },
            ],
        })
    })

    test('keeps GraphQL object type descriptions in schema output models', () => {
        const schema = buildSchema(`
            "Application user."
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.objectTypes.get('User')).toMatchObject({
            description: 'Application user.',
        })
    })

    test('keeps GraphQL argument descriptions in schema output models', () => {
        const schema = buildSchema(`
            type Query {
                users(
                    "Argument Query.users(filter:) applies user search filters."
                    filter: String
                ): [String!]!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.fieldArgTypes.find(model =>
            model.parentTypeName === 'Query' && model.fieldName === 'users'
        )?.type).toMatchObject({
            kind: 'object',
            fields: [
                {
                    name: 'filter',
                    description: 'Argument Query.users(filter:) applies user search filters.',
                    remarks: 'Scalar reference: `Scalars[\'String\'][\'input\']`.',
                },
            ],
        })
    })

    test('keeps GraphQL output field scalar replacement comments in schema output models', () => {
        const schema = buildSchema(`
            scalar DateTime

            type Query {
                createdAt: DateTime!
            }
        `)

        const { schema: schemaOutput } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema }),
            { DateTime: defineNamed('Date') }
        )

        expect(schemaOutput.objectTypes.get('Query')).toMatchObject({
            fields: {
                kind: 'object',
                fields: [
                    { name: '__typename' },
                    {
                        name: 'createdAt',
                        remarks: 'Scalar reference: `Scalars[\'DateTime\'][\'output\']`.',
                    },
                ],
            },
        })
    })

    test('keeps GraphQL enum descriptions in registry models', () => {
        const schema = buildSchema(`
            "User account statuses."
            enum UserStatus {
                ACTIVE
            }

            type Query {
                status: UserStatus!
            }
        `)

        const { registry } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(registry.enums.get('UserStatus')).toMatchObject({
            description: 'User account statuses.',
            entries: [
                { name: 'ACTIVE', value: 'ACTIVE' },
            ],
        })
    })

    test('keeps GraphQL enum value descriptions and deprecation reasons in registry models', () => {
        const schema = buildSchema(`
            enum UserStatus {
                "Active user."
                ACTIVE
                BLOCKED @deprecated(reason: "Use ACTIVE instead")
            }

            type Query {
                status: UserStatus!
            }
        `)

        const { registry } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(registry.enums.get('UserStatus')).toEqual({
            entries: [
                { name: 'ACTIVE', value: 'ACTIVE', description: 'Active user.' },
                { name: 'BLOCKED', value: 'BLOCKED', deprecationReason: 'Use ACTIVE instead' },
            ],
        })
    })

    test('collects registered enums and specified scalars', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            type User {
                id: ID!
                createdAt: String!
                status: UserStatus!
            }

            type Query {
                user: User!
            }
        `)
        const documents = [{
            location: 'user.graphql',
            document: parse(`
                fragment UserStatusFields on User {
                    id
                    createdAt
                    status
                }
            `),
        }]

        const {
            schema: { scalars },
            registry: {
                enums,
                fragments,
            },
        } = buildGenerationModels(
            {
                fragments: [],
                enums: [ 'UserStatus' ],
            },
            makeTestModelContext({
                schema,
                documents,
            }),
            { String: defineNamed('DateIsoString') }
        )

        expect(enums.get('UserStatus')).toEqual({
            entries: [
                { name: 'ACTIVE', value: 'ACTIVE' },
                { name: 'BLOCKED', value: 'BLOCKED' },
            ],
        })

        expect(scalars.get('String')).toEqual({
            input: 'DateIsoString',
            output: 'DateIsoString',
        })
        expect(scalars.get('ID')).toEqual({
            input: 'string',
            output: 'string',
        })

        expect(fragments.size).toBe(0)
    })

    test('builds fragment models with nested objects, enums and fragment spreads', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            type Profile {
                bio: String
            }

            type User {
                id: ID!
                status: UserStatus!
                profile: Profile
            }

            type Query {
                user: User!
            }
        `)
        const documents = [{
            location: 'user.graphql',
            document: parse(`
                fragment UserBase on User {
                    id
                }

                fragment UserCard on User {
                    ...UserBase
                    status
                    profile {
                        bio
                    }
                }
            `),
        }]

        const { registry: { fragments } } = buildGenerationModels(
            {
                fragments: [ 'UserBase', 'UserCard' ],
                enums: [ 'UserStatus' ],
            },
            makeTestModelContext({
                schema,
                documents,
            }), {}
        )

        expect(fragments.get('UserBase')).toEqual(expect.objectContaining({
            onType: 'User',
            root: {
                kind: FRAGMENT_ROOT_KIND.OBJECT,
                fields: [expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                    responseName: 'id',
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        name: 'ID',
                        usage: 'output',
                    },
                })],
            },
        }))

        expect(fragments.get('UserCard')).toEqual(expect.objectContaining({
            onType: 'User',
            root: {
                kind: FRAGMENT_ROOT_KIND.OBJECT,
                fields: expect.arrayContaining([expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                    name: 'UserBase',
                    onType: 'User',
                }), expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'status',
                    responseName: 'status',
                    value: {
                        kind: VALUE_MODEL_KIND.ENUM,
                        name: 'UserStatus',
                    },
                }), expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'profile',
                    responseName: 'profile',
                    value: expect.objectContaining({
                        kind: VALUE_MODEL_KIND.OBJECT,
                        fields: [expect.objectContaining({
                            kind: SELECTION_MODEL_KIND.FIELD,
                            name: 'bio',
                            responseName: 'bio',
                            value: {
                                kind: VALUE_MODEL_KIND.SCALAR,
                                name: 'String',
                                usage: 'output',
                            },
                        })],
                    }),
                })]),
            },
        }))
    })

    test('specializes interface selections with explicit __typename into concrete variants', () => {
        const schema = buildSchema(`
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

            type Group {
                owner: User!
            }

            type Query {
                group: Group!
            }
        `)
        const documents = [{
            location: 'group.graphql',
            document: parse(`
                fragment GroupOwner on Group {
                    owner {
                        __typename
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
        }]

        const { registry: { fragments } } = buildGenerationModels(
            {
                fragments: [ 'GroupOwner' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                documents,
            }), {}
        )

        const groupOwner = fragments.get('GroupOwner')

        expect(groupOwner).not.toBeUndefined()

        expect(groupOwner?.onType).toBe('Group')
        expect(groupOwner?.root.kind).toBe(FRAGMENT_ROOT_KIND.OBJECT)
        expect(groupOwner?.root.kind === FRAGMENT_ROOT_KIND.OBJECT && groupOwner.root.fields).toHaveLength(1)

        const ownerField = groupOwner?.root.kind === FRAGMENT_ROOT_KIND.OBJECT
            ? groupOwner.root.fields[0]
            : undefined

        expect(ownerField).not.toBeUndefined()
        expect(ownerField?.kind).toBe(SELECTION_MODEL_KIND.FIELD)

        const ownerValue = ownerField && 'value' in ownerField ? ownerField.value : undefined

        expect(ownerValue?.kind, 'Expected owner field to be a union model').toBe(VALUE_MODEL_KIND.UNION)

        const ownerVariants = ownerValue && 'variants' in ownerValue ? ownerValue.variants : undefined

        expect(ownerVariants).not.toBeUndefined()
        expect(ownerVariants).toEqual([{
            typeName: 'UserPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: '__typename',
                    value: {
                        kind: VALUE_MODEL_KIND.TYPENAME,
                        typeNames: [ 'UserPayload' ],
                    },
                }),
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        name: 'ID',
                        usage: 'output',
                    },
                }),
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    typeCondition: 'UserPayload',
                }),
            ]),
        }, {
            typeName: 'AdminPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: '__typename',
                    value: {
                        kind: VALUE_MODEL_KIND.TYPENAME,
                        typeNames: [ 'AdminPayload' ],
                    },
                }),
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        name: 'ID',
                        usage: 'output',
                    },
                }),
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    typeCondition: 'AdminPayload',
                }),
            ]),
        }])
    })

    test('specializes nested interface selections without explicit __typename into concrete variants', () => {
        const schema = buildSchema(`
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

            type Group {
                owner: User!
            }

            type Query {
                group: Group!
            }
        `)
        const documents = [{
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
        }]

        const { registry: { fragments } } = buildGenerationModels(
            {
                fragments: [ 'GroupOwner' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                documents,
            }), {}
        )

        const groupOwner = fragments.get('GroupOwner')
        const ownerField = groupOwner?.root.kind === FRAGMENT_ROOT_KIND.OBJECT
            ? groupOwner.root.fields[0]
            : undefined

        expect(ownerField).not.toBeUndefined()
        expect(ownerField?.kind).toBe(SELECTION_MODEL_KIND.FIELD)

        const ownerValue = ownerField && 'value' in ownerField ? ownerField.value : undefined

        expect(ownerValue?.kind, 'Expected owner field to be a union model').toBe(VALUE_MODEL_KIND.UNION)
        expect(ownerValue && 'variants' in ownerValue ? ownerValue.variants : undefined).toEqual([{
            typeName: 'UserPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        name: 'ID',
                        usage: 'output',
                    },
                }),
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    typeCondition: 'UserPayload',
                }),
            ]),
        }, {
            typeName: 'AdminPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        name: 'ID',
                        usage: 'output',
                    },
                }),
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    typeCondition: 'AdminPayload',
                }),
            ]),
        }])
    })

    test('stores only runtime-conditional directives and prunes statically excluded selections', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
                name: String!
                email: String!
            }

            type Query {
                user: User!
            }
        `)
        const documents = [{
            location: 'user.graphql',
            document: parse(`
                fragment UserBase on User {
                    id
                }

                fragment UserCard on User {
                    name @include(if: $withName)
                    email @skip(if: true)
                    ...UserBase @skip(if: $withoutBase)
                    ... @include(if: false) {
                        id
                    }
                }
            `),
        }]

        const { registry: { fragments } } = buildGenerationModels(
            {
                fragments: [ 'UserCard' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                documents,
            }), {}
        )

        expect(fragments.get('UserCard')).toEqual(expect.objectContaining({
            root: {
                kind: FRAGMENT_ROOT_KIND.OBJECT,
                fields: [
                    expect.objectContaining({
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: 'name',
                        directiveNames: [ 'include' ],
                    }),
                    expect.objectContaining({
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'UserBase',
                        directiveNames: [ 'skip' ],
                    }),
                ],
            },
        }))
        const conditionalUserCard = fragments.get('UserCard')

        expect(conditionalUserCard?.root.kind).toBe(FRAGMENT_ROOT_KIND.OBJECT)
        expect(conditionalUserCard?.root.kind === FRAGMENT_ROOT_KIND.OBJECT
            ? conditionalUserCard.root.fields
            : undefined).toHaveLength(2)
    })

    test('applies custom directive policies while building models', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
                name: String!
                email: String!
            }

            type Query {
                user: User!
            }
        `)
        const documents = [{
            location: 'user.graphql',
            document: parse(`
                fragment UserCard on User {
                    id @mask
                    name @trace
                    email @clientOnly
                }
            `),
        }]

        const { registry: { fragments } } = buildGenerationModels(
            {
                fragments: [ 'UserCard' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                directivePolicies: {
                    mask: { effect: 'conditional' },
                    trace: { effect: 'ignore' },
                    clientOnly: { effect: 'exclude' },
                },
                documents,
            }), {}
        )

        const policyUserCard = fragments.get('UserCard')

        expect(policyUserCard?.root.kind).toBe(FRAGMENT_ROOT_KIND.OBJECT)
        expect(policyUserCard?.root.kind === FRAGMENT_ROOT_KIND.OBJECT
            ? policyUserCard.root.fields
            : undefined).toEqual([
            expect.objectContaining({
                kind: SELECTION_MODEL_KIND.FIELD,
                name: 'id',
                conditional: true,
                directiveNames: [ 'mask' ],
            }),
            expect.objectContaining({
                kind: SELECTION_MODEL_KIND.FIELD,
                name: 'name',
            }),
        ])
    })
})
