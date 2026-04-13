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
})
