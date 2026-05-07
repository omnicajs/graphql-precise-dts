import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildModelRegistry } from '../../src/models/registry-builder'
import { makeDocumentModelBundles } from '../../src/plan/document-model-bundles'
import { makeTestModelContext } from './helpers/model-context'
import {
    buildSchema,
    parse,
} from 'graphql'

const createImportMap = (
    fragments: [string, string][] = [],
    enums: [string, string][] = []
) => ({
    fragments: new Map<string, string>(fragments),
    enums: new Map<string, string>(enums),
})

const prepareBundleInputs = (
    schemaSource: string,
    documentSource: string,
    registryNames: { fragments?: string[]; enums?: string[] } = {},
    importMap = createImportMap()
) => {
    const schema = buildSchema(schemaSource)
    const documents = [{
        location: 'user.graphql',
        document: parse(documentSource),
    }]

    const context = makeTestModelContext({
        schema,
        documents,
    })
    const fragments = buildModelRegistry(
        {
            fragments: registryNames.fragments ?? [],
            enums: registryNames.enums ?? [],
        },
        context
    ).documents.fragments

    return {
        context,
        documents,
        fragments,
        importMap,
    }
}

describe('document model bundles', () => {
    // This suite covers the collision matrix enforced by validateDocumentBundleExportNames:
    // type namespace: imports, fragments, variable aliases, output aliases, operation Variables/Payload exports
    // value namespace: operation document exports such as getUserQuery
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

    test('fails when a fragment export collides with an imported type name', () => {
        const { context, documents, fragments, importMap } = prepareBundleInputs(`
            enum UserStatus {
                ACTIVE
            }

            type User {
                status: UserStatus!
            }
        `,
        `
            fragment UserStatus on User {
                status
            }
        `,
        { fragments: [ 'UserStatus' ], enums: [ 'UserStatus' ] },
        createImportMap([], [
            [ 'UserStatus', './schema.d.ts' ],
        ]))

        expect(() => makeDocumentModelBundles(documents, fragments, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "UserStatus" is used both by imported type "UserStatus" and by fragment "UserStatus".')
    })

    test('fails when an imported type name collides with an operation variables export', () => {
        const { context, documents, fragments, importMap } = prepareBundleInputs(`
            enum GetUserQueryVariables {
                ACTIVE
            }

            type User {
                status: GetUserQueryVariables!
            }

            type Query {
                user: User
            }
        `,
        `
            query getUser {
                user {
                    status
                }
            }
        `,
        {},
        createImportMap([], [
            [ 'GetUserQueryVariables', './schema.d.ts' ],
        ]))

        expect(() => makeDocumentModelBundles(documents, fragments, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryVariables" is used both by imported type "GetUserQueryVariables" and by generated variables type "GetUserQueryVariables".')
    })

    test('fails when an imported type name collides with an operation payload export', () => {
        const { context, documents, fragments, importMap } = prepareBundleInputs(`
            enum GetUserQueryPayload {
                ACTIVE
            }

            type User {
                status: GetUserQueryPayload!
            }

            type Query {
                user: User
            }
        `,
        `
            query getUser {
                user {
                    status
                }
            }
        `,
        {},
        createImportMap([], [
            [ 'GetUserQueryPayload', './schema.d.ts' ],
        ]))

        expect(() => makeDocumentModelBundles(documents, fragments, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryPayload" is used both by imported type "GetUserQueryPayload" and by generated payload type "GetUserQueryPayload".')
    })

    test('fails when a fragment export collides with an operation variables export', () => {
        const { context, documents, fragments, importMap } = prepareBundleInputs(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `,
        `
            fragment GetUserQueryVariables on User {
                id
            }

            query getUser {
                user {
                    ...GetUserQueryVariables
                }
            }
        `,
        { fragments: [ 'GetUserQueryVariables' ] })

        expect(() => makeDocumentModelBundles(documents, fragments, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryVariables" is used both by fragment "GetUserQueryVariables" and by generated variables type "GetUserQueryVariables".')
    })

    test('fails when a fragment export collides with an operation payload export', () => {
        const { context, documents, fragments, importMap } = prepareBundleInputs(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `,
        `
            fragment GetUserQueryPayload on User {
                id
            }

            query getUser {
                user {
                    ...GetUserQueryPayload
                }
            }
        `,
        { fragments: [ 'GetUserQueryPayload' ] })

        expect(() => makeDocumentModelBundles(documents, fragments, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryPayload" is used both by fragment "GetUserQueryPayload" and by generated payload type "GetUserQueryPayload".')
    })

    test('fails when operation variables exports collide after operation name normalization', () => {
        const { context, documents, fragments, importMap } = prepareBundleInputs(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `,
        `
            query getUser {
                user {
                    id
                }
            }

            query GetUser {
                user {
                    id
                }
            }
        `)

        expect(() => makeDocumentModelBundles(documents, fragments, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryVariables" is used both by generated variables type "GetUserQueryVariables" and by generated variables type "GetUserQueryVariables".')
    })
})
