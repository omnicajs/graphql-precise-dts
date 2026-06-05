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
    test('builds schema output models from GraphQL schema types', () => {
        const schema = buildSchema(`
            interface Node {
                id: ID!
            }

            type Query {
                user(id: ID!, filter: UserFilter): User
                search: SearchResult!
            }

            type User implements Node {
                id: ID!
                status: UserStatus!
            }

            type Group {
                id: ID!
            }

            input UserFilter {
                status: UserStatus
            }

            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            union SearchResult = User | Group
        `)

        const { schema: schemaOutput, registry } = buildGenerationModels(
            { fragments: [], enums: [] },
            makeTestModelContext({ schema })
        )

        expect(schemaOutput.inputTypes.get('UserFilter')).not.toBeUndefined()
        expect(renderType(schemaOutput.inputTypes.get('UserFilter')!)).toBe([
            '{',
            `\tstatus?: UserStatus | null;`,
            '}',
        ].join('\n'))

        expect(schemaOutput.interfaceTypes.get('Node')).not.toBeUndefined()
        expect(renderType(schemaOutput.interfaceTypes.get('Node')!)).toBe([
            '{',
            `\tid: string;`,
            '}',
        ].join('\n'))

        expect(schemaOutput.objectTypes.get('User')?.interfaces).toEqual([ 'Node' ])

        expect(schemaOutput.unionTypes.get('SearchResult')).not.toBeUndefined()
        expect(renderType(schemaOutput.unionTypes.get('SearchResult')!)).toBe('User | Group')

        expect(schemaOutput.fieldArgs.get('QueryUserArgs')).not.toBeUndefined()
        expect(renderType(schemaOutput.fieldArgs.get('QueryUserArgs')!)).toBe([
            '{',
            `\tid: string;`,
            `\tfilter?: UserFilter | null;`,
            '}',
        ].join('\n'))

        expect(schemaOutput.enumReferences).toEqual(new Set([ 'UserStatus' ]))

        expect(registry.enums.get('UserStatus')).toEqual([
            { name: 'ACTIVE', value: 'ACTIVE' },
            { name: 'BLOCKED', value: 'BLOCKED' },
        ])
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

        expect(enums.get('UserStatus')).toEqual([
            { name: 'ACTIVE', value: 'ACTIVE' },
            { name: 'BLOCKED', value: 'BLOCKED' },
        ])

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
