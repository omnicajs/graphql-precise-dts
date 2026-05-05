import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    buildSchema,
    parse,
} from 'graphql'
import { buildModelRegistry } from '../../src/models/registry-builder'
import { makeDocumentModelBundles } from '../../src/plan/document-model-bundles'
import { makeTestModelContext } from './helpers/model-context'

describe('document model bundles', () => {
    test('builds document model bundles for documents with fragments and operations', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user(id: ID!): User
            }
        `)

        const documents = [{
            location: 'user.graphql',
            document: parse(`
                fragment UserDetails on User {
                    id
                }

                query UserQuery($id: ID!) {
                    user(id: $id) {
                        ...UserDetails
                    }
                }
            `),
        }, {
            location: 'empty.graphql',
            document: undefined,
        }]

        const context = makeTestModelContext({
            schema,
            documents,
        })
        const fragments = buildModelRegistry(
            { fragments: [ 'UserDetails' ], enums: [] },
            context
        ).documents.fragments
        const importMap = {
            fragments: new Map<string, string>(),
            enums: new Map<string, string>(),
        }

        const bundles = makeDocumentModelBundles(documents, fragments, context, importMap, {}, {})

        expect(bundles).toHaveLength(1)
        expect(bundles[0]).toMatchObject({ location: 'user.graphql' })
        expect([ ...bundles[0].models.fragments.keys() ]).toEqual([ 'UserDetails' ])
        expect([ ...bundles[0].models.operations.keys() ]).toEqual([ 'UserQuery' ])
    })

    test('skips documents without AST and ignores unnamed or duplicate operations', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)

        const documents = [{
            location: 'broken.graphql',
            document: undefined,
        }, {
            location: 'user.graphql',
            document: parse(`
                fragment UserDetails on User {
                    id
                }

                query {
                    user {
                        id
                    }
                }

                query UserQuery {
                    user {
                        ...UserDetails
                    }
                }

                query UserQuery {
                    user {
                        id
                    }
                }
            `),
        }]

        const context = makeTestModelContext({
            schema,
            documents,
        })
        const fragments = buildModelRegistry(
            { fragments: [ 'UserDetails' ], enums: [] },
            context
        ).documents.fragments
        const importMap = {
            fragments: new Map<string, string>(),
            enums: new Map<string, string>(),
        }

        const bundles = makeDocumentModelBundles(documents, fragments, context, importMap, {}, {})

        expect(bundles).toHaveLength(1)
        expect(bundles[0]).toMatchObject({ location: 'user.graphql' })
        expect([ ...bundles[0].models.fragments.keys() ]).toEqual([ 'UserDetails' ])
        expect([ ...bundles[0].models.operations.keys() ]).toEqual([ 'UserQuery' ])
    })
})
