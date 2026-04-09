import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildModelRegistry } from '../../src/models/builder'
import { buildSchema } from 'graphql'
import { makeTestModelContext } from '../fixtures/builders/model-context'
import { parse } from 'graphql'

import {
    FragmentRootKind,
    SelectionModelKind,
    ValueModelKind,
} from '../../src/models/kinds'

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

        const registry = buildModelRegistry(
            {
                fragments: [],
                enums: [ 'UserStatus' ],
            },
            makeTestModelContext({
                schema,
                customScalars: { String: 'DateIsoString' },
                documents,
            })
        )

        expect(registry.schema.enums.get('UserStatus')).toEqual([
            { name: 'ACTIVE', value: 'ACTIVE' },
            { name: 'BLOCKED', value: 'BLOCKED' },
        ])

        expect(registry.schema.scalars.get('String')).toEqual({
            input: 'DateIsoString',
            output: 'DateIsoString',
        })
        expect(registry.schema.scalars.get('ID')).toEqual({
            input: 'string',
            output: 'string',
        })

        expect(registry.documents.fragments.size).toBe(0)
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

        const registry = buildModelRegistry(
            {
                fragments: [ 'UserBase', 'UserCard' ],
                enums: [ 'UserStatus' ],
            },
            makeTestModelContext({
                schema,
                documents,
            })
        )

        expect(registry.documents.fragments.get('UserBase')).toEqual(expect.objectContaining({
            onType: 'User',
            root: {
                kind: FragmentRootKind.OBJECT,
                fields: [expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'id',
                    responseName: 'id',
                    value: {
                        kind: ValueModelKind.SCALAR,
                        typeTs: 'string',
                    },
                    directives: [],
                })],
            },
        }))

        expect(registry.documents.fragments.get('UserCard')).toEqual(expect.objectContaining({
            onType: 'User',
            root: {
                kind: FragmentRootKind.OBJECT,
                fields: expect.arrayContaining([expect.objectContaining({
                    kind: SelectionModelKind.FRAGMENT_SPREAD,
                    name: 'UserBase',
                    onType: 'User',
                    directives: [],
                }), expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'status',
                    responseName: 'status',
                    value: {
                        kind: ValueModelKind.ENUM,
                        name: 'UserStatus',
                    },
                    directives: [],
                }), expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'profile',
                    responseName: 'profile',
                    value: expect.objectContaining({
                        kind: ValueModelKind.OBJECT,
                        fields: [expect.objectContaining({
                            kind: SelectionModelKind.FIELD,
                            name: 'bio',
                            responseName: 'bio',
                            value: {
                                kind: ValueModelKind.SCALAR,
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

        const registry = buildModelRegistry(
            {
                fragments: [ 'GroupOwner' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                documents,
            })
        )

        const groupOwner = registry.documents.fragments.get('GroupOwner')

        expect(groupOwner).not.toBeUndefined()

        expect(groupOwner?.onType).toBe('Group')
        expect(groupOwner?.root.kind).toBe(FragmentRootKind.OBJECT)
        expect(groupOwner?.root.kind === FragmentRootKind.OBJECT && groupOwner.root.fields).toHaveLength(1)

        const ownerField = groupOwner?.root.kind === FragmentRootKind.OBJECT
            ? groupOwner.root.fields[0]
            : undefined

        expect(ownerField).not.toBeUndefined()
        expect(ownerField?.kind).toBe(SelectionModelKind.FIELD)

        const ownerValue = ownerField && 'value' in ownerField ? ownerField.value : undefined

        expect(ownerValue?.kind, 'Expected owner field to be a union model').toBe(ValueModelKind.UNION)

        const ownerVariants = ownerValue && 'variants' in ownerValue ? ownerValue.variants : undefined

        expect(ownerVariants).not.toBeUndefined()
        expect(ownerVariants).toEqual([{
            typeName: 'UserPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: '__typename',
                    value: {
                        kind: ValueModelKind.TYPENAME,
                        typeNames: [ 'UserPayload' ],
                    },
                }),
                expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'id',
                    value: {
                        kind: ValueModelKind.SCALAR,
                        typeTs: 'string',
                    },
                }),
                expect.objectContaining({
                    kind: SelectionModelKind.INLINE_FRAGMENT,
                    typeCondition: 'UserPayload',
                }),
            ]),
        }, {
            typeName: 'AdminPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: '__typename',
                    value: {
                        kind: ValueModelKind.TYPENAME,
                        typeNames: [ 'AdminPayload' ],
                    },
                }),
                expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'id',
                    value: {
                        kind: ValueModelKind.SCALAR,
                        typeTs: 'string',
                    },
                }),
                expect.objectContaining({
                    kind: SelectionModelKind.INLINE_FRAGMENT,
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

        const registry = buildModelRegistry(
            {
                fragments: [ 'GroupOwner' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                documents,
            })
        )

        const groupOwner = registry.documents.fragments.get('GroupOwner')
        const ownerField = groupOwner?.root.kind === FragmentRootKind.OBJECT
            ? groupOwner.root.fields[0]
            : undefined

        expect(ownerField).not.toBeUndefined()
        expect(ownerField?.kind).toBe(SelectionModelKind.FIELD)

        const ownerValue = ownerField && 'value' in ownerField ? ownerField.value : undefined

        expect(ownerValue?.kind, 'Expected owner field to be a union model').toBe(ValueModelKind.UNION)
        expect(ownerValue && 'variants' in ownerValue ? ownerValue.variants : undefined).toEqual([{
            typeName: 'UserPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'id',
                    value: {
                        kind: ValueModelKind.SCALAR,
                        typeTs: 'string',
                    },
                }),
                expect.objectContaining({
                    kind: SelectionModelKind.INLINE_FRAGMENT,
                    typeCondition: 'UserPayload',
                }),
            ]),
        }, {
            typeName: 'AdminPayload',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    kind: SelectionModelKind.FIELD,
                    name: 'id',
                    value: {
                        kind: ValueModelKind.SCALAR,
                        typeTs: 'string',
                    },
                }),
                expect.objectContaining({
                    kind: SelectionModelKind.INLINE_FRAGMENT,
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

        const registry = buildModelRegistry(
            {
                fragments: [ 'UserCard' ],
                enums: [],
            },
            makeTestModelContext({
                schema,
                documents,
            })
        )

        expect(registry.documents.fragments.get('UserCard')).toEqual(expect.objectContaining({
            root: {
                kind: FragmentRootKind.OBJECT,
                fields: [
                    expect.objectContaining({
                        kind: SelectionModelKind.FIELD,
                        name: 'name',
                        directives: [ 'include' ],
                    }),
                    expect.objectContaining({
                        kind: SelectionModelKind.FRAGMENT_SPREAD,
                        name: 'UserBase',
                        directives: [ 'skip' ],
                    }),
                ],
            },
        }))
        const conditionalUserCard = registry.documents.fragments.get('UserCard')

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

        const registry = buildModelRegistry(
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
            })
        )

        const policyUserCard = registry.documents.fragments.get('UserCard')

        expect(policyUserCard?.root.kind).toBe(FragmentRootKind.OBJECT)
        expect(policyUserCard?.root.kind === FragmentRootKind.OBJECT
            ? policyUserCard.root.fields
            : undefined).toEqual([
            expect.objectContaining({
                kind: SelectionModelKind.FIELD,
                name: 'id',
                conditional: true,
                directives: [ 'mask' ],
            }),
            expect.objectContaining({
                kind: SelectionModelKind.FIELD,
                name: 'name',
                conditional: false,
                directives: [],
            }),
        ])
    })
})
