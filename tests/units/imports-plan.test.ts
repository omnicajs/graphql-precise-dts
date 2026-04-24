import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { collectImportsForDocumentModels } from '../../src/plan/imports'
import {
    declarationDefinitions,
    enumValue,
    field,
    fragment,
    inputField,
    inputObjectValue,
} from '../fixtures/builders/declaration-render'
import { makeImportMap } from '../../src/plan/imports'
import { parse } from 'graphql'
import {
    objectValue,
    operation,
} from '../fixtures/builders/declaration-render'

import { FRAGMENT_ROOT_KIND } from '../../src/models/kinds'
import { OperationTypeNode } from 'graphql'
import { VALUE_MODEL_KIND } from '../../src/models/kinds'

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

        const importMap = makeImportMap(
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
                        inputField('filter', inputObjectValue([
                            inputField('status', {
                                kind: VALUE_MODEL_KIND.ENUM,
                                name: 'UserStatus',
                            }),
                        ])),
                    ]
                )],
            ])
        )

        const imports = collectImportsForDocumentModels(models, {
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
                        inputField('status', {
                            kind: VALUE_MODEL_KIND.ENUM,
                            name: 'UserStatus',
                        }),
                    ]
                )],
            ])
        )

        const imports = collectImportsForDocumentModels(models, {
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

        const imports = collectImportsForDocumentModels(models, {
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

        const importMap = makeImportMap(
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

        const importMap = makeImportMap(
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

        const imports = collectImportsForDocumentModels(models, {
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
