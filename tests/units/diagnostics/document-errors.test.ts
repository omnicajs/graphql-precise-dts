import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { assertUniqueDocumentModuleSpecifiers } from '../../../src/diagnostics/declaration-errors'

import {
    assertNamedOperation,
    emitSkippedDocumentWarnings,
    guardNamedOperations,
} from '../../../src/diagnostics/document-errors'

import {
    buildSchema,
    parse,
} from 'graphql'

describe('document errors', () => {
    test('ignores empty document bundles when checking module specifier collisions', () => {
        expect(() => assertUniqueDocumentModuleSpecifiers([
            {
                location: 'empty-a.graphql',
                imports: new Map(),
                models: {
                    fragments: new Map(),
                    operations: new Map(),
                    variableAliases: [],
                    outputAliases: [],
                },
            },
            {
                location: 'empty-b.graphql',
                imports: new Map(),
                models: {
                    fragments: new Map(),
                    operations: new Map(),
                    variableAliases: [],
                    outputAliases: [],
                },
            },
        ], () => 'same-module')).not.toThrow()
    })

    test('uses provided and unknown fallback locations for missing operation names', () => {
        const operation = parse('query { __typename }', { noLocation: true }).definitions[0]

        expect(() => assertNamedOperation(
            operation as never,
            new WeakMap(),
            'inline.graphql'
        )).toThrow(/Operation name is missing for query operation in "inline\.graphql"/)

        expect(() => assertNamedOperation(
            operation as never,
            new WeakMap()
        )).toThrow(/Operation name is missing for query operation in "<unknown document>"/)
    })

    test('uses fallback locations for duplicate variables without node locations', () => {
        const schema = buildSchema(`
            type Query {
                user(id: ID): String
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse('query UserQuery($id: ID, $id: String) { user(id: $id) }', { noLocation: true }),
        }], schema)).toThrow(/Duplicate variable "\$id" detected in operation "UserQuery" at "inline\.graphql". The first definition is in "inline\.graphql"./)
    })

    test('uses unknown fallback locations for root and variable errors without document locations', () => {
        const schema = buildSchema(`
            type Query {
                user: String
            }
        `)

        expect(() => guardNamedOperations([{
            document: parse('mutation UpdateUser { update }', { noLocation: true }),
        }], schema)).toThrow(/Root type for mutation operation "UpdateUser" was not found in schema at "<unknown document>"/)

        expect(() => guardNamedOperations([{
            document: parse('query UserQuery($id: ID, $id: String) { user }', { noLocation: true }),
        }], schema)).toThrow(/Duplicate variable "\$id" detected in operation "UserQuery" at "<unknown document>". The first definition is in "<unknown document>"./)
    })

    test('fails when a field uses an argument that is not defined by the schema', () => {
        const schema = buildSchema(`
            type Query {
                user: String
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse('query UserQuery($id: ID) { user(id: $id) }', { noLocation: true }),
        }], schema)).toThrow(/Unknown argument "id" detected on field "Query\.user" at "inline\.graphql". Field arguments must match the GraphQL schema./)
    })

    test('fails when a field selection is not defined by the schema', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse('query UserQuery { user { missingField } }', { noLocation: true }),
        }], schema)).toThrow(/Unknown field "missingField" detected on type "User" at "inline\.graphql". Field selections must match the GraphQL schema./)
    })

    test('fails when a fragment type condition is not defined by the schema', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse(`
                fragment MissingDetails on MissingType {
                    id
                }
            `, { noLocation: true }),
        }], schema)).toThrow(/Unknown fragment type "MissingType" detected at "inline\.graphql". Fragment type conditions must reference types from the GraphQL schema./)
    })

    test('fails when an inline fragment type condition is not defined by the schema', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse(`
                query UserQuery {
                    user {
                        ... on MissingType {
                            id
                        }
                    }
                }
            `, { noLocation: true }),
        }], schema)).toThrow(/Unknown inline fragment type "MissingType" detected at "inline\.graphql". Inline fragment type conditions must reference types from the GraphQL schema./)
    })

    test('uses unknown fallback locations for unknown fragment type conditions without document locations', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        expect(() => guardNamedOperations([{
            document: parse(`
                fragment MissingDetails on MissingType {
                    id
                }
            `, { noLocation: true }),
        }], schema)).toThrow(/Unknown fragment type "MissingType" detected at "<unknown document>". Fragment type conditions must reference types from the GraphQL schema./)

        expect(() => guardNamedOperations([{
            document: parse(`
                query UserQuery {
                    user {
                        ... on MissingType {
                            id
                        }
                    }
                }
            `, { noLocation: true }),
        }], schema)).toThrow(/Unknown inline fragment type "MissingType" detected at "<unknown document>". Inline fragment type conditions must reference types from the GraphQL schema./)
    })

    test('allows inline fragments without type conditions', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse(`
                query UserQuery {
                    user {
                        ... {
                            id
                        }
                    }
                }
            `, { noLocation: true }),
        }], schema)).not.toThrow()
    })

    test('uses unknown fallback locations for unknown field selections without document locations', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User
            }
        `)

        expect(() => guardNamedOperations([{
            document: parse('query UserQuery { user { missingField } }', { noLocation: true }),
        }], schema)).toThrow(/Unknown field "missingField" detected on type "User" at "<unknown document>". Field selections must match the GraphQL schema./)
    })

    test('uses unknown fallback locations for field argument errors without document locations', () => {
        const schema = buildSchema(`
            type Query {
                user(id: ID!): String
                group: String
            }
        `)

        expect(() => guardNamedOperations([{
            document: parse('query UserQuery { user }', { noLocation: true }),
        }], schema)).toThrow(/Required argument "id" is missing on field "Query\.user" at "<unknown document>". Required field arguments must be provided./)

        expect(() => guardNamedOperations([{
            document: parse('query GroupQuery($id: ID) { group(id: $id) }', { noLocation: true }),
        }], schema)).toThrow(/Unknown argument "id" detected on field "Query\.group" at "<unknown document>". Field arguments must match the GraphQL schema./)
    })

    test('allows missing optional field arguments and requires required arguments', () => {
        const schema = buildSchema(`
            type Query {
                user(id: ID!, locale: String, format: String): String
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse('query UserQuery { user(id: "1", format: "short") }', { noLocation: true }),
        }], schema)).not.toThrow()

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse('query UserQuery { user(format: "short") }', { noLocation: true }),
        }], schema)).toThrow(/Required argument "id" is missing on field "Query\.user" at "inline\.graphql". Required field arguments must be provided./)
    })

    test('allows fields without arguments when none are required by the schema', () => {
        const schema = buildSchema(`
            type Query {
                group: String
            }
        `)

        expect(() => guardNamedOperations([{
            location: 'inline.graphql',
            document: parse('query GroupQuery { group }', { noLocation: true }),
        }], schema)).not.toThrow()
    })

    test('uses unknown document location for skipped documents without location', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        emitSkippedDocumentWarnings([{}])

        expect(warn).toHaveBeenCalledWith(expect.stringContaining(
            'Document "<unknown document>" was skipped because no parsed GraphQL AST was provided to the plugin.'
        ))

        warn.mockRestore()
    })
})
