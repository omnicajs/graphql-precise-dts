import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import {
    defineBoolean,
    defineNamed,
    defineString,
} from '../../src'
import {
    getFragmentDefinition,
    getOperationDefinition,
} from './helpers/graphql-document'
import {
    makeFragmentModel,
    makeOperationModel,
} from '../../src/models/documents-builder'
import { makeTestModelContext } from './helpers/model-context'

import {
    FRAGMENT_ROOT_KIND,
    VALUE_MODEL_KIND,
} from '../../src/models/kinds'

describe('documents builder', () => {
    test('builds union fragment roots for abstract fragments with type-specific branches', () => {
        const schema = buildSchema(`
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
        const definition = getFragmentDefinition(`
            fragment UserDetails on User {
                id
                ... on UserPayload {
                    permissions
                }
                ... on AdminPayload {
                    role
                }
            }
        `)

        const model = makeFragmentModel(definition, makeTestModelContext({ schema }))

        expect(model.root.kind).toBe(FRAGMENT_ROOT_KIND.UNION)
        expect(model.root.kind === FRAGMENT_ROOT_KIND.UNION
            ? model.root.variants.map(variant => variant.typeName)
            : []
        ).toEqual([ 'UserPayload', 'AdminPayload' ])
    })

    test('builds operation models with optional variables when defaults are present', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user(id: ID!, includeInactive: Boolean): User
            }
        `)
        const definition = getOperationDefinition(`
            query UserQuery($id: ID!, $includeInactive: Boolean = false) {
                user(id: $id, includeInactive: $includeInactive) {
                    id
                }
            }
        `)

        const model = makeOperationModel(definition, makeTestModelContext({ schema }))

        expect(model).toMatchObject({
            operationType: 'query',
            onType: 'Query',
            variables: [
                expect.objectContaining({
                    name: 'id',
                    optional: false,
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        typeTs: defineString(),
                    },
                }),
                expect.objectContaining({
                    name: 'includeInactive',
                    optional: true,
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        typeTs: defineBoolean(),
                    },
                }),
            ],
        })
    })

    test('uses custom scalar input types for operation variables', () => {
        const schema = buildSchema(`
            scalar DateTime

            type User {
                id: ID!
            }

            type Query {
                users(createdAfter: DateTime!): [User!]!
            }
        `)
        const definition = getOperationDefinition(`
            query UserQuery($createdAfter: DateTime!) {
                users(createdAfter: $createdAfter) {
                    id
                }
            }
        `)

        const model = makeOperationModel(definition, makeTestModelContext({
            schema,
            customScalars: {
                DateTime: {
                    input: defineString(),
                    output: defineNamed('Date'),
                },
            },
        }))

        expect(model).toMatchObject({
            variables: [
                expect.objectContaining({
                    name: 'createdAfter',
                    optional: false,
                    value: {
                        kind: VALUE_MODEL_KIND.SCALAR,
                        typeTs: defineString(),
                    },
                }),
            ],
        })
    })

    test('returns undefined for operations without a matching schema root type', () => {
        const schema = buildSchema(`
            type Query {
                user: String
            }
        `)
        const definition = getOperationDefinition(`
            mutation UpdateUser {
                __typename
            }
        `)

        expect(makeOperationModel(
            definition,
            makeTestModelContext({ schema })
        )).toBeUndefined()
    })
})
