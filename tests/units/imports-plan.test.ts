import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { collectDocumentModelImports } from '../../src/plan/document-model-imports'
import {
    declarationDefinitions,
    enumValue,
    field,
    fragment,
} from '../fixtures/builders/declaration-render'
import { makeDocumentModelImportMap } from '../../src/plan/document-model-imports'
import {
    objectValue,
    operation,
} from '../fixtures/builders/declaration-render'
import { parse } from 'graphql'
import {
    variableField,
    variableObjectValue,
} from '../fixtures/builders/declaration-render'

import { FRAGMENT_ROOT_KIND } from '../../src/kinds'
import { OperationTypeNode } from 'graphql'
import { VALUE_MODEL_KIND } from '../../src/kinds'

describe('imports plan', () => {
    test('collects fragment and enum import sources from GraphQL documents', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            type User {
                id: ID!
                status: UserStatus!
            }

            type Query {
                users(status: UserStatus): [User!]!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                location: 'fragments/user.graphql',
                document: parse(`
                    fragment UserDetails on User {
                        id
                        status
                    }
                `),
            }, {
                location: 'queries/users.graphql',
                document: parse(`
                    query UsersQuery($status: UserStatus) {
                        users(status: $status) {
                            ...UserDetails
                        }
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.fragments).toEqual(new Map([
            [ 'UserDetails', '~docs/fragments/user.graphql' ],
        ]))
        expect(importMap.enums).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
    })

    test('collects nested fragment and enum imports from document models', () => {
        const models = declarationDefinitions(
            new Map([
                ['UserDetails', fragment([
                    {
                        kind: 'fragmentSpread',
                        name: 'SharedFields',
                        onType: 'User',
                        conditional: false,
                    },
                    field('status', enumValue('UserStatus')),
                    field('profile', objectValue([
                        field('role', enumValue('UserRole')),
                    ]), false),
                ], 'User')],
            ]),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [],
                    [
                        variableField('filter', variableObjectValue([
                            variableField('status', {
                                kind: VALUE_MODEL_KIND.ENUM,
                                name: 'UserStatus',
                            }),
                        ])),
                    ]
                )],
            ])
        )

        const imports = collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'SharedFields', './shared.graphql' ],
            ]),
            enums: new Map([
                [ 'UserStatus', './schema' ],
                [ 'UserRole', './schema' ],
            ]),
        })

        expect(imports).toEqual(new Map([
            [ 'SharedFields', './shared.graphql' ],
            [ 'UserStatus', './schema' ],
            [ 'UserRole', './schema' ],
        ]))
    })

    test('collects direct enum imports from operation variables', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [],
                    [
                        variableField('status', {
                            kind: VALUE_MODEL_KIND.ENUM,
                            name: 'UserStatus',
                        }),
                    ]
                )],
            ])
        )

        const imports = collectDocumentModelImports(models, {
            fragments: new Map(),
            enums: new Map([
                [ 'UserStatus', './schema' ],
            ]),
        })

        expect(imports).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
    })

    test('collects enum imports from field values in document models', () => {
        const models = declarationDefinitions(
            new Map([
                ['UserDetails', fragment([
                    field('status', enumValue('UserStatus')),
                ], 'User')],
            ]),
            new Map()
        )

        const imports = collectDocumentModelImports(models, {
            fragments: new Map(),
            enums: new Map([
                [ 'UserStatus', './schema' ],
            ]),
        })

        expect(imports).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
    })

    test('skips document entries without AST and deduplicates collected imports', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            type User {
                id: ID!
                status: UserStatus!
            }

            type Query {
                users(status: UserStatus): [User!]!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                location: 'broken.graphql',
            }, {
                location: 'fragments/user.graphql',
                document: parse(`
                    fragment UserDetails on User {
                        id
                        status
                    }
                `),
            }, {
                location: 'queries/users.graphql',
                document: parse(`
                    query UsersQuery($status: UserStatus) {
                        users(status: $status) {
                            ...UserDetails
                            ...UserDetails
                        }
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.fragments).toEqual(new Map([
            [ 'UserDetails', '~docs/fragments/user.graphql' ],
        ]))
        expect(importMap.enums).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
    })

    test('collects enum imports from inline enum literal values', () => {
        const schema = buildSchema(`
            enum UserStatus {
                ACTIVE
                BLOCKED
            }

            type User {
                id: ID!
                status: UserStatus!
            }

            type Query {
                users(status: UserStatus): [User!]!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                location: 'queries/users.graphql',
                document: parse(`
                    query UsersQuery {
                        users(status: ACTIVE) {
                            id
                        }
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.fragments).toEqual(new Map())
        expect(importMap.enums).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
    })

    test('collects imports from union fragment variants', () => {
        const models = declarationDefinitions(
            new Map([
                ['SearchResultDetails', {
                    name: 'SearchResultDetails',
                    onType: 'SearchResult',
                    onTypeNames: [ 'User', 'Group' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.UNION,
                        variants: [{
                            typeName: 'User',
                            fields: [
                                {
                                    kind: 'fragmentSpread',
                                    name: 'UserBase',
                                    onType: 'User',
                                    directives: [],
                                    conditional: false,
                                },
                            ],
                        }, {
                            typeName: 'Group',
                            fields: [
                                field('visibility', enumValue('GroupVisibility')),
                            ],
                        }],
                    },
                }],
            ]),
            new Map()
        )

        const imports = collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'UserBase', './user-base.graphql' ],
            ]),
            enums: new Map([
                [ 'GroupVisibility', './schema' ],
            ]),
        })

        expect(imports).toEqual(new Map([
            [ 'UserBase', './user-base.graphql' ],
            [ 'GroupVisibility', './schema' ],
        ]))
    })
})
