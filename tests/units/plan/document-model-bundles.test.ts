import {
    describe,
    expect,
    test,
} from 'vitest'

import { makeDocumentModelBundles } from '../../../src/plan/document-model-bundles'
import { makeTestModelContext } from '../helpers/model-context'
import {
    buildSchema,
    parse,
} from 'graphql'

const createImportMap = (
    fragments: [string, string][] = [],
    enums: [string, string][] = []
) => ({
    fragments: new Map(fragments.map(([name, moduleSpecifier]) => [
        name,
        [{
            location: moduleSpecifier,
            moduleSpecifier,
        }],
    ])),
    enums: new Map<string, string>(enums),
    documentImports: new Map(),
})

const prepareBundleInputs = (
    schemaSource: string,
    documentSource: string,
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

    return {
        context,
        documents,
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
        const importMap = {
            fragments: new Map(),
            enums: new Map<string, string>(),
            documentImports: new Map(),
        }

        const bundles = makeDocumentModelBundles(documents, context, importMap, {}, {})

        expect(bundles).toHaveLength(1)
        expect(bundles[0]).toMatchObject({ location: 'user.graphql' })
        expect([ ...bundles[0].models.fragments.keys() ]).toEqual([ 'UserDetails' ])
        expect([ ...bundles[0].models.operations.keys() ]).toEqual([ 'UserQuery' ])
    })

    test('builds document model bundles for documents without locations', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const documents = [{
            document: parse(`
                fragment UserDetails on User {
                    id
                }
            `),
        }]
        const context = makeTestModelContext({
            schema,
            documents,
        })

        const bundles = makeDocumentModelBundles(documents, context, createImportMap(), {}, {})

        expect(bundles).toHaveLength(1)
        expect(bundles[0]).toMatchObject({ location: '' })
        expect([ ...bundles[0].models.fragments.keys() ]).toEqual([ 'UserDetails' ])
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
        const importMap = {
            fragments: new Map(),
            enums: new Map<string, string>(),
            documentImports: new Map(),
        }

        const bundles = makeDocumentModelBundles(documents, context, importMap, {}, {})

        expect(bundles).toHaveLength(1)
        expect(bundles[0]).toMatchObject({ location: 'user.graphql' })
        expect([ ...bundles[0].models.fragments.keys() ]).toEqual([ 'UserDetails' ])
        expect([ ...bundles[0].models.operations.keys() ]).toEqual([ 'UserQuery' ])
    })

    test('fails when a fragment export collides with an imported type name', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
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
        createImportMap([], [
            [ 'UserStatus', './schema.d.ts' ],
        ]))

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "UserStatus" is used both by imported type "UserStatus" and by fragment "UserStatus".')
    })

    test('fails when a fragment export collides with the Exact helper import', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
            type User {
                id: ID!
            }

            type Query {
                user(id: ID!): User
            }
        `,
        `
            fragment Exact on User {
                id
            }

            query GetUser($id: ID!) {
                user(id: $id) {
                    ...Exact
                }
            }
        `
        )

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "Exact" is used both by imported type "Exact" and by fragment "Exact".')
    })

    test('avoids collisions between generated variable aliases and fragment exports', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
            input TreeInput {
                value: String
                children: [TreeInput!]
            }

            type Query {
                noop: Boolean
            }

            type Mutation {
                createTree(input: TreeInput!): Boolean!
            }
        `,
        `
            fragment TreeInputAlias on Query {
                noop
            }

            mutation CreateTree($input: TreeInput!) {
                createTree(input: $input)
            }
        `
        )

        const [ bundle ] = makeDocumentModelBundles(documents, context, importMap, {}, {})
        const aliasName = bundle.models.variableAliases[0]?.aliasName

        expect(aliasName).toMatch(/^TreeInputAlias_[a-f0-9]{4}$/)
        expect([ ...bundle.models.fragments.keys() ]).toEqual([ 'TreeInputAlias' ])
    })

    test('avoids collisions between generated output aliases and fragment exports', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
            type Profile {
                id: ID!
            }

            type User {
                id: ID!
                primaryProfile: Profile!
                secondaryProfile: Profile!
            }

            type Query {
                user: User!
            }
        `,
        `
            fragment ProfileAlias on User {
                id
            }

            query UserProfiles {
                user {
                    primaryProfile {
                        id
                    }
                    secondaryProfile {
                        id
                    }
                }
            }
        `
        )

        const [ bundle ] = makeDocumentModelBundles(documents, context, importMap, {}, {})
        const aliasName = bundle.models.outputAliases[0]?.aliasName

        expect(aliasName).toMatch(/^ProfileAlias_[a-f0-9]{4}$/)
        expect([ ...bundle.models.fragments.keys() ]).toEqual([ 'ProfileAlias' ])
    })

    test('fails when an imported type name collides with an operation variables export', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
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
        createImportMap([], [
            [ 'GetUserQueryVariables', './schema.d.ts' ],
        ]))

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryVariables" is used both by imported type "GetUserQueryVariables" and by generated variables type "GetUserQueryVariables".')
    })

    test('fails when an imported type name collides with an operation payload export', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
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
        createImportMap([], [
            [ 'GetUserQueryPayload', './schema.d.ts' ],
        ]))

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryPayload" is used both by imported type "GetUserQueryPayload" and by generated payload type "GetUserQueryPayload".')
    })

    test('fails when a fragment export collides with an operation variables export', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
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
        `
        )

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryVariables" is used both by fragment "GetUserQueryVariables" and by generated variables type "GetUserQueryVariables".')
    })

    test('fails when a fragment export collides with an operation payload export', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
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
        `
        )

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryPayload" is used both by fragment "GetUserQueryPayload" and by generated payload type "GetUserQueryPayload".')
    })

    test('fails when operation variables exports collide after operation name normalization', () => {
        const { context, documents, importMap } = prepareBundleInputs(`
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

        expect(() => makeDocumentModelBundles(documents, context, importMap, {}, {}))
            .toThrow('Name collision detected in generated declaration exports for "user.graphql": "GetUserQueryVariables" is used both by generated variables type "GetUserQueryVariables" and by generated variables type "GetUserQueryVariables".')
    })
})
