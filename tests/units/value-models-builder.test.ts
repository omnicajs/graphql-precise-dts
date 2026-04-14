import type {
    FieldNode,
    GraphQLInputType,
} from 'graphql'
import type { TypeFieldNode } from '../../src/models/selection'

import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { getFragmentDefinition } from './helpers/graphql-document'
import { getSelectionNode } from './helpers/graphql-selection'
import { getTypeForDefinition } from '../../src/models/resolve'
import {
    makeFieldValue,
    makeInputValue,
} from '../../src/models/value-models-builder'
import { makeTestModelContext } from './helpers/model-context'
import { parse } from 'graphql'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../src/models/kinds'

describe('value models builder', () => {
    test('builds union field values for interface selections with distinct concrete branches', () => {
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
        const definition = getFragmentDefinition(`
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
        `)

        const ownerSelection = getSelectionNode(definition, 0) as FieldNode
        const typeSelection = getTypeForDefinition(definition, schema).get(ownerSelection)

        expect(typeSelection).toBeDefined()
        expect(typeSelection?.kind).toBe(SELECTION_MODEL_KIND.FIELD)

        const value = makeFieldValue(
            typeSelection as TypeFieldNode,
            ownerSelection,
            makeTestModelContext({ schema })
        )

        expect(value).toMatchObject({
            kind: VALUE_MODEL_KIND.UNION,
            variants: [
                {
                    typeName: 'UserPayload',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            kind: SELECTION_MODEL_KIND.FIELD,
                            name: 'id',
                        }),
                        expect.objectContaining({
                            kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                            typeCondition: 'UserPayload',
                            selections: [
                                expect.objectContaining({
                                    kind: SELECTION_MODEL_KIND.FIELD,
                                    name: 'permissions',
                                }),
                            ],
                        }),
                    ]),
                },
                {
                    typeName: 'AdminPayload',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            kind: SELECTION_MODEL_KIND.FIELD,
                            name: 'id',
                        }),
                        expect.objectContaining({
                            kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                            typeCondition: 'AdminPayload',
                            selections: [
                                expect.objectContaining({
                                    kind: SELECTION_MODEL_KIND.FIELD,
                                    name: 'role',
                                }),
                            ],
                        }),
                    ]),
                },
            ],
        })
    })

    test('keeps interface field as object value when type-specific inline fragments are excluded', () => {
        const schema = buildSchema(`
            interface User {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
            }

            type AdminPayload implements User {
                id: ID!
            }

            type Group {
                owner: User!
            }

            type Query {
                group: Group!
            }
        `)
        const definition = getFragmentDefinition(`
            fragment GroupOwner on Group {
                owner {
                    id
                    ... on UserPayload @clientOnly {
                        __typename
                    }
                }
            }
        `)

        const ownerSelection = getSelectionNode(definition, 0) as FieldNode
        const typeSelection = getTypeForDefinition(definition, schema).get(ownerSelection)

        expect(typeSelection).toBeDefined()
        expect(typeSelection?.kind).toBe(SELECTION_MODEL_KIND.FIELD)

        const value = makeFieldValue(
            typeSelection as TypeFieldNode,
            ownerSelection,
            makeTestModelContext({
                schema,
                directivePolicies: {
                    clientOnly: {
                        inlineFragment: { effect: 'exclude' },
                    },
                },
            })
        )

        expect(value).toMatchObject({
            kind: VALUE_MODEL_KIND.OBJECT,
            typeNames: [ 'UserPayload', 'AdminPayload' ],
            fields: [
                expect.objectContaining({
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                }),
            ],
        })
    })

    test('builds nested input object values', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            input UserFilter {
                status: UserStatus
                email: String!
            }

            type Query {
                users: [String!]!
            }
        `)

        const inputType = schema.getType('UserFilter')
        expect(inputType).toBeDefined()

        const value = makeInputValue(inputType as GraphQLInputType, {})

        expect(value).toEqual({
            kind: VALUE_MODEL_KIND.OBJECT,
            fields: [
                {
                    name: 'status',
                    typeRef: {
                        kind: 'named',
                        name: 'UserStatus',
                    },
                    optional: true,
                    value: {
                        kind: VALUE_MODEL_KIND.ENUM,
                        name: 'UserStatus',
                    },
                },
                {
                    name: 'email',
                    typeRef: {
                        kind: 'non-null',
                        ofType: {
                            kind: 'named',
                            name: 'String',
                        },
                    },
                    optional: false,
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        typeTs: 'string',
                    },
                },
            ],
        })
    })

    test('keeps only inline fragments when building union variants', () => {
        const schema = buildSchema(`
            type UserPayload {
                id: ID!
                name: String!
            }

            type GroupPayload {
                id: ID!
                slug: String!
            }

            union SearchResult = UserPayload | GroupPayload

            type Query {
                search: SearchResult!
            }
        `)
        const document = parse(`
            fragment SearchResultDetails on Query {
                search {
                    __typename
                    ... on UserPayload {
                        name
                    }
                    ... on GroupPayload {
                        slug
                    }
                }
            }
        `)
        const definition = getFragmentDefinition(`
            fragment SearchResultDetails on Query {
                search {
                    __typename
                    ... on UserPayload {
                        name
                    }
                    ... on GroupPayload {
                        slug
                    }
                }
            }
        `)

        const searchSelection = getSelectionNode(definition, 0) as FieldNode
        const typeSelection = getTypeForDefinition(definition, schema).get(searchSelection)

        expect(typeSelection).toBeDefined()
        expect(typeSelection?.kind).toBe(SELECTION_MODEL_KIND.FIELD)

        const value = makeFieldValue(
            typeSelection as TypeFieldNode,
            searchSelection,
            makeTestModelContext({
                schema,
                documents: [{
                    location: 'search.graphql',
                    document,
                }],
            })
        )

        expect(value).toEqual({
            kind: VALUE_MODEL_KIND.UNION,
            variants: [{
                typeName: 'UserPayload',
                fields: [
                    expect.objectContaining({
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: 'name',
                    }),
                ],
            }, {
                typeName: 'GroupPayload',
                fields: [
                    expect.objectContaining({
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: 'slug',
                    }),
                ],
            }],
        })
    })
})
