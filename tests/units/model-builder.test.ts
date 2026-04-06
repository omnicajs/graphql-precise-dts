import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { buildDefinitionRegistry } from '../../src/modules/model-builder'
import { parse } from 'graphql'

import {
    DefinitionNodeKind,
    FieldValueKind,
    FragmentRootKind,
} from '../../src/enums/model-kinds'

describe('model builder', () => {
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

        const registry = buildDefinitionRegistry(
            schema,
            [{
                location: 'user.graphql',
                document: parse(`
                    fragment UserStatusFields on User {
                        id
                        createdAt
                        status
                    }
                `),
            }],
            {
                fragment: [],
                enums: [ 'UserStatus' ],
            },
            { String: 'DateIsoString' }
        )

        expect(registry.enums.get('UserStatus')).toEqual([
            { name: 'ACTIVE', value: 'ACTIVE' },
            { name: 'BLOCKED', value: 'BLOCKED' },
        ])

        expect(registry.scalars.get('String')).toEqual({
            input: 'DateIsoString',
            output: 'DateIsoString',
        })
        expect(registry.scalars.get('ID')).toEqual({
            input: 'string',
            output: 'string',
        })

        expect(registry.fragments.size).toBe(0)
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

        const registry = buildDefinitionRegistry(
            schema,
            [{
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
            }],
            {
                fragment: [ 'UserBase', 'UserCard' ],
                enums: [ 'UserStatus' ],
            },
            {}
        )

        expect(registry.fragments.get('UserBase')).toEqual(expect.objectContaining({
            onType: 'User',
            root: {
                kind: FragmentRootKind.OBJECT,
                fields: [expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: 'id',
                    responseName: 'id',
                    value: {
                        kind: FieldValueKind.SCALAR,
                        typeTs: 'string',
                    },
                    directives: [],
                })],
            },
        }))

        expect(registry.fragments.get('UserCard')).toEqual(expect.objectContaining({
            onType: 'User',
            root: {
                kind: FragmentRootKind.OBJECT,
                fields: expect.arrayContaining([expect.objectContaining({
                    kind: DefinitionNodeKind.FRAGMENT_SPREAD,
                    name: 'UserBase',
                    onType: 'User',
                    directives: [],
                }), expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: 'status',
                    responseName: 'status',
                    value: {
                        kind: FieldValueKind.ENUM,
                        name: 'UserStatus',
                    },
                    directives: [],
                }), expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: 'profile',
                    responseName: 'profile',
                    value: expect.objectContaining({
                        kind: FieldValueKind.OBJECT,
                        fields: [expect.objectContaining({
                            kind: DefinitionNodeKind.FIELD,
                            name: 'bio',
                            responseName: 'bio',
                            value: {
                                kind: FieldValueKind.SCALAR,
                                typeTs: 'string',
                            },
                            directives: [],
                        })],
                    }),
                    directives: [],
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

        const registry = buildDefinitionRegistry(
            schema,
            [{
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
            }],
            {
                fragment: [ 'GroupOwner' ],
                enums: [],
            },
            {}
        )

        const groupOwner = registry.fragments.get('GroupOwner')

        expect(groupOwner).not.toBeUndefined()

        expect(groupOwner?.onType).toBe('Group')
        expect(groupOwner?.root.kind).toBe(FragmentRootKind.OBJECT)
        expect(groupOwner?.root.kind === FragmentRootKind.OBJECT && groupOwner.root.fields).toHaveLength(1)

        const ownerField = groupOwner?.root.kind === FragmentRootKind.OBJECT
            ? groupOwner.root.fields[0]
            : undefined

        expect(ownerField).not.toBeUndefined()

        expect(ownerField?.kind).toBe(DefinitionNodeKind.FIELD)

        const ownerValue = ownerField && 'value' in ownerField ? ownerField.value : undefined

        expect(ownerValue?.kind, 'Expected owner field to be a union model').toBe(FieldValueKind.UNION)

        const ownerVariants = ownerValue && 'variants' in ownerValue ? ownerValue.variants : undefined

        expect(ownerVariants).not.toBeUndefined()
        expect(ownerVariants).toEqual([{
            typeName: 'UserPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: '__typename',
                    value: {
                        kind: FieldValueKind.TYPENAME,
                        typeNames: [ 'UserPayload' ],
                    },
                }),
                expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: 'id',
                    value: {
                        kind: FieldValueKind.SCALAR,
                        typeTs: 'string',
                    },
                }),
                expect.objectContaining({
                    kind: DefinitionNodeKind.INLINE_FRAGMENT,
                    typeCondition: 'UserPayload',
                }),
            ]),
        }, {
            typeName: 'AdminPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: '__typename',
                    value: {
                        kind: FieldValueKind.TYPENAME,
                        typeNames: [ 'AdminPayload' ],
                    },
                }),
                expect.objectContaining({
                    kind: DefinitionNodeKind.FIELD,
                    name: 'id',
                    value: {
                        kind: FieldValueKind.SCALAR,
                        typeTs: 'string',
                    },
                }),
                expect.objectContaining({
                    kind: DefinitionNodeKind.INLINE_FRAGMENT,
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

        const registry = buildDefinitionRegistry(
            schema,
            [{
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
            }],
            {
                fragment: [ 'UserCard' ],
                enums: [],
            },
            {}
        )

        expect(registry.fragments.get('UserCard')).toEqual(expect.objectContaining({
            root: {
                kind: FragmentRootKind.OBJECT,
                fields: [
                    expect.objectContaining({
                        kind: DefinitionNodeKind.FIELD,
                        name: 'name',
                        directives: [ 'include' ],
                    }),
                    expect.objectContaining({
                        kind: DefinitionNodeKind.FRAGMENT_SPREAD,
                        name: 'UserBase',
                        directives: [ 'skip' ],
                    }),
                ],
            },
        }))
        const conditionalUserCard = registry.fragments.get('UserCard')

        expect(conditionalUserCard?.root.kind).toBe(FragmentRootKind.OBJECT)
        expect(conditionalUserCard?.root.kind === FragmentRootKind.OBJECT
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

        const registry = buildDefinitionRegistry(
            schema,
            [{
                location: 'user.graphql',
                document: parse(`
                    fragment UserCard on User {
                        id @mask
                        name @trace
                        email @clientOnly
                    }
                `),
            }],
            {
                fragment: [ 'UserCard' ],
                enums: [],
            },
            {},
            {
                mask: { effect: 'conditional' },
                trace: { effect: 'ignore' },
                clientOnly: { effect: 'exclude' },
            }
        )

        const policyUserCard = registry.fragments.get('UserCard')

        expect(policyUserCard?.root.kind).toBe(FragmentRootKind.OBJECT)
        expect(policyUserCard?.root.kind === FragmentRootKind.OBJECT
            ? policyUserCard.root.fields
            : undefined).toEqual([
            expect.objectContaining({
                kind: DefinitionNodeKind.FIELD,
                name: 'id',
                conditional: true,
                directives: [ 'mask' ],
            }),
            expect.objectContaining({
                kind: DefinitionNodeKind.FIELD,
                name: 'name',
                conditional: false,
                directives: [],
            }),
        ])
    })
})
