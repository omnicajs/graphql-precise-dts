import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    mkdirSync,
    writeFileSync,
} from 'fs'
import { join } from 'path'

import {
    collectDocumentModelImports,
    makeDocumentModelImportMap,
} from '../../../src/plan/document-model-imports'

import { withTempOutput } from '../utils/temp-output'

import {
    declarationDefinitions,
    enumValue,
    field,
    fragment,
    objectValue,
    operation,
    variableField,
    variableObjectValue,
} from '../../fixtures/builders/declaration-render'

import {
    buildSchema,
    parse,
} from 'graphql'

import {
    FRAGMENT_ROOT_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'
import { OperationTypeNode } from 'graphql'

const fragmentImportSources = (
    fragments: [string, string][]
) => new Map(fragments.map(([name, moduleSpecifier]) => [
    name,
    [{
        location: moduleSpecifier,
        moduleSpecifier,
    }],
]))

const documentFragmentImportSources = (
    fragments: [string, string][]
) => new Map(fragments.map(([name, location]) => [
    name,
    [{
        location,
        moduleSpecifier: `~docs/${location}`,
    }],
]))

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

        expect(importMap.fragments).toEqual(documentFragmentImportSources([
            [ 'UserDetails', 'fragments/user.graphql' ],
        ]))
        expect(importMap.enums).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
        expect(importMap.documentImports).toEqual(new Map())
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
            fragments: fragmentImportSources([
                [ 'SharedFields', './shared.graphql' ],
            ]),
            enums: new Map([
                [ 'UserStatus', './schema' ],
                [ 'UserRole', './schema' ],
            ]),
            documentImports: new Map([
                [ 'user.graphql', new Set([ './shared.graphql' ]) ],
            ]),
        }, 'user.graphql')

        expect(imports).toEqual(new Map([
            [ 'SharedFields', './shared.graphql' ],
            [ 'UserStatus', './schema' ],
            [ 'UserRole', './schema' ],
        ]))
    })

    test('does not import fragment spreads that are declared in the same document model', () => {
        const models = declarationDefinitions(
            new Map([
                ['UserDetails', fragment([
                    {
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    },
                    {
                        kind: 'fragmentSpread',
                        name: 'SharedFields',
                        onType: 'User',
                        conditional: false,
                    },
                ], 'User')],
            ]),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [
                        {
                            kind: 'fragmentSpread',
                            name: 'UserDetails',
                            onType: 'User',
                            conditional: false,
                        },
                        {
                            kind: 'fragmentSpread',
                            name: 'SharedFields',
                            onType: 'User',
                            conditional: false,
                        },
                    ]
                )],
            ])
        )

        const imports = collectDocumentModelImports(models, {
            fragments: fragmentImportSources([
                [ 'UserDetails', './first-user-details.graphql' ],
                [ 'SharedFields', './shared-fields.graphql' ],
            ]),
            enums: new Map(),
            documentImports: new Map([
                [ 'user.graphql', new Set([ './shared-fields.graphql' ]) ],
            ]),
        }, 'user.graphql')

        expect(imports).toEqual(new Map([
            [ 'SharedFields', './shared-fields.graphql' ],
        ]))
    })

    test('uses the fragment source imported by the current document location', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        const imports = collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'UserDetails', [{
                    location: 'queries/users.graphql',
                    moduleSpecifier: '~docs/queries/users.graphql',
                }, {
                    location: 'generated/user.graphql',
                    moduleSpecifier: '~docs/generated/user.graphql',
                }, {
                    location: 'fragments/user.graphql',
                    moduleSpecifier: '~docs/fragments/user.graphql',
                }] ],
            ]),
            enums: new Map(),
            documentImports: new Map([
                [ 'queries/users.graphql', new Set([ 'fragments/user.graphql' ]) ],
            ]),
        }, 'queries/users.graphql')

        expect(imports).toEqual(new Map([
            [ 'UserDetails', '~docs/fragments/user.graphql' ],
        ]))
    })

    test('fails when multiple imported documents provide the referenced fragment', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        expect(() => collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'UserDetails', [{
                    location: 'fragments/user.graphql',
                    moduleSpecifier: '~docs/fragments/user.graphql',
                }, {
                    location: 'generated/user.graphql',
                    moduleSpecifier: '~docs/generated/user.graphql',
                }] ],
            ]),
            enums: new Map(),
            documentImports: new Map([
                [ 'queries/users.graphql', new Set([
                    'fragments/user.graphql',
                    'generated/user.graphql',
                ]) ],
            ]),
        }, 'queries/users.graphql'))
            .toThrow('Fragment definition "UserDetails" referenced from "queries/users.graphql" is ambiguous because multiple imported documents define it.')
    })

    test('fails when an external fragment source is available without a document import', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        expect(() => collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'UserDetails', [{
                    location: 'fragments/user.graphql',
                    moduleSpecifier: '~docs/fragments/user.graphql',
                }, {
                    location: 'generated/user.graphql',
                    moduleSpecifier: '~docs/generated/user.graphql',
                }] ],
            ]),
            enums: new Map(),
            documentImports: new Map(),
        }, 'queries/users.graphql'))
            .toThrow('Fragment definition "UserDetails" referenced from "queries/users.graphql" is external, but the document does not declare any #import for it.')
    })

    test('uses an unknown document label when an external fragment source is available without a collector location', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        expect(() => collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'UserDetails', [{
                    location: 'fragments/user.graphql',
                    moduleSpecifier: '~docs/fragments/user.graphql',
                }] ],
            ]),
            enums: new Map(),
            documentImports: new Map(),
        })).toThrow('Fragment definition "UserDetails" referenced from "<unknown document>" is external, but the document does not declare any #import for it.')
    })

    test('fails when document imports do not provide the referenced fragment', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        expect(() => collectDocumentModelImports(models, {
            fragments: new Map([
                [ 'UserDetails', [{
                    location: 'fragments/user.graphql',
                    moduleSpecifier: '~docs/fragments/user.graphql',
                }] ],
            ]),
            enums: new Map(),
            documentImports: new Map([
                [ 'queries/users.graphql', new Set([ 'fragments/other.graphql' ]) ],
            ]),
        }, 'queries/users.graphql'))
            .toThrow('Fragment definition "UserDetails" referenced from "queries/users.graphql" was not found in that document\'s imports.')
    })

    test('fails when a referenced fragment is not configured anywhere', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        expect(() => collectDocumentModelImports(models, {
            fragments: new Map(),
            enums: new Map(),
            documentImports: new Map(),
        }, 'queries/users.graphql'))
            .toThrow('Fragment definition "UserDetails" referenced from "queries/users.graphql" was not found among the documents configured for the plugin.')
    })

    test('uses an unknown document label when a referenced fragment is not configured anywhere without a collector location', () => {
        const models = declarationDefinitions(
            new Map(),
            new Map([
                ['UsersQuery', operation(
                    OperationTypeNode.QUERY,
                    [{
                        kind: 'fragmentSpread',
                        name: 'UserDetails',
                        onType: 'User',
                        conditional: false,
                    }]
                )],
            ])
        )

        expect(() => collectDocumentModelImports(models, {
            fragments: new Map(),
            enums: new Map(),
            documentImports: new Map(),
        }))
            .toThrow('Fragment definition "UserDetails" referenced from "<unknown document>" was not found among the documents configured for the plugin.')
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
            fragments: fragmentImportSources([]),
            enums: new Map([
                [ 'UserStatus', './schema' ],
            ]),
            documentImports: new Map(),
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
            fragments: fragmentImportSources([]),
            enums: new Map([
                [ 'UserStatus', './schema' ],
            ]),
            documentImports: new Map(),
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

        expect(importMap.fragments).toEqual(documentFragmentImportSources([
            [ 'UserDetails', 'fragments/user.graphql' ],
        ]))
        expect(importMap.enums).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
        expect(importMap.documentImports).toEqual(new Map())
    })

    test('keeps fragment import sources unique by document location', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                location: 'fragments/user.graphql',
                document: parse(`
                    fragment UserDetails on User {
                        id
                    }
                `),
            }, {
                location: 'generated/user.graphql',
                document: parse(`
                    fragment UserDetails on User {
                        id
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.fragments).toEqual(new Map([
            [ 'UserDetails', [{
                location: 'fragments/user.graphql',
                moduleSpecifier: '~docs/fragments/user.graphql',
            }, {
                location: 'generated/user.graphql',
                moduleSpecifier: '~docs/generated/user.graphql',
            }] ],
        ]))
        expect(importMap.documentImports).toEqual(new Map())
    })

    test('collects fragment import sources from documents without locations', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                document: parse(`
                    fragment UserDetails on User {
                        id
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.fragments).toEqual(new Map([
            [ 'UserDetails', [{
                location: undefined,
                moduleSpecifier: '~docs/*.graphql',
            }] ],
        ]))
        expect(importMap.documentImports).toEqual(new Map())
    })

    test('collects document import locations from raw SDL', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                location: 'queries/user.graphql',
                rawSDL: '#import "../fragments/UserDetails.graphql"',
                document: parse(`
                    query UserQuery {
                        user {
                            ...UserDetails
                        }
                    }
                `),
            }, {
                location: 'fragments/UserDetails.graphql',
                document: parse(`
                    fragment UserDetails on User {
                        id
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.documentImports).toEqual(new Map([
            [ 'queries/user.graphql', new Set([ 'fragments/UserDetails.graphql' ]) ],
        ]))
    })

    test('collects absolute document import locations from raw SDL', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)

        const importMap = makeDocumentModelImportMap(
            schema,
            [{
                location: '/documents/queries/user.graphql',
                rawSDL: '#import "/documents/fragments/UserDetails.graphql"',
                document: parse(`
                    query UserQuery {
                        user {
                            ...UserDetails
                        }
                    }
                `),
            }, {
                location: '/documents/fragments/UserDetails.graphql',
                document: parse(`
                    fragment UserDetails on User {
                        id
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )

        expect(importMap.documentImports).toEqual(new Map([
            [ '/documents/queries/user.graphql', new Set([ '/documents/fragments/UserDetails.graphql' ]) ],
        ]))
    })

    test('collects document import locations from a document file on disk', async () => {
        await withTempOutput(async ({ tempDir }) => {
            const schema = buildSchema(`
                type User {
                    id: ID!
                }

                type Query {
                    user: User!
                }
            `)
            const queryLocation = join(tempDir, 'queries/user.graphql')
            const fragmentLocation = join(tempDir, 'fragments/UserDetails.graphql')

            mkdirSync(join(tempDir, 'queries'), { recursive: true })
            mkdirSync(join(tempDir, 'fragments'), { recursive: true })
            writeFileSync(queryLocation, '#import "../fragments/UserDetails.graphql"')

            const importMap = makeDocumentModelImportMap(
                schema,
                [{
                    location: queryLocation,
                    document: parse(`
                        query UserQuery {
                            user {
                                ...UserDetails
                            }
                        }
                    `),
                }, {
                    location: fragmentLocation,
                    document: parse(`
                        fragment UserDetails on User {
                            id
                        }
                    `),
                }],
                './schema',
                location => `~docs/${location ?? '*.graphql'}`
            )

            expect(importMap.documentImports).toEqual(new Map([
                [ queryLocation, new Set([ fragmentLocation ]) ],
            ]))
        })
    })

    test('fails when a raw SDL import references a document outside the configured documents', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)

        expect(() => makeDocumentModelImportMap(
            schema,
            [{
                location: 'queries/user.graphql',
                rawSDL: '#import "../fragments/UserDetails.graphql"',
                document: parse(`
                    query UserQuery {
                        user {
                            ...UserDetails
                        }
                    }
                `),
            }],
            './schema',
            location => `~docs/${location ?? '*.graphql'}`
        )).toThrow(
            'Document "queries/user.graphql" imports "fragments/UserDetails.graphql", but that document was not found among the documents configured for the plugin.'
        )
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

        expect(importMap.fragments).toEqual(fragmentImportSources([]))
        expect(importMap.enums).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
        expect(importMap.documentImports).toEqual(new Map())
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
            fragments: fragmentImportSources([
                [ 'UserBase', './user-base.graphql' ],
            ]),
            enums: new Map([
                [ 'GroupVisibility', './schema' ],
            ]),
            documentImports: new Map([
                [ 'search.graphql', new Set([ './user-base.graphql' ]) ],
            ]),
        }, 'search.graphql')

        expect(imports).toEqual(new Map([
            [ 'UserBase', './user-base.graphql' ],
            [ 'GroupVisibility', './schema' ],
        ]))
    })

    test('deduplicates enum imports collected from multiple field values', () => {
        const models = declarationDefinitions(
            new Map([
                ['UserDetails', fragment([
                    field('status', enumValue('UserStatus')),
                    field('previousStatus', enumValue('UserStatus')),
                ], 'User')],
            ]),
            new Map()
        )

        const imports = collectDocumentModelImports(models, {
            fragments: fragmentImportSources([]),
            enums: new Map([
                [ 'UserStatus', './schema' ],
            ]),
            documentImports: new Map(),
        })

        expect(imports).toEqual(new Map([
            [ 'UserStatus', './schema' ],
        ]))
    })
})
