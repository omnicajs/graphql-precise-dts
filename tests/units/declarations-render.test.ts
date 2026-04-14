import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import {
    declarationDefinitions,
    enumValue,
    field,
    fragment,
    inputField,
    inputObjectValue,
    namedType,
    operation,
    objectValue,
} from '../fixtures/builders/declaration-render'
import { renderDeclaration } from '../../src/render/declarations'
import {
    scalar,
    typenameValue,
    unionValue,
} from '../fixtures/builders/declaration-render'

import { FRAGMENT_ROOT_KIND } from '../../src/models/kinds'
import { OperationTypeNode } from 'graphql'
import {
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../../src/models/kinds'

describe('declaration render', () => {
    describe('imports and module wrapper', () => {
        test('sorts imports alphabetically', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(new Map([
                    ['UserScalars', fragment([
                        field('id', scalar('string'), false),
                    ], 'User')],
                ])),
                new Map([
                    ['UserStatus', './artifacts.d.ts'],
                    ['AdminBadge', './admin.d.ts'],
                    ['SharedFields', './fragments/SharedFields.graphql'],
                ])
            )

            expect(result).toContain([
                'declare module \'./documents\' {',
                '\timport type { AdminBadge } from \'./admin.d.ts\'',
                '\timport type { SharedFields } from \'./fragments/SharedFields.graphql\'',
                '\timport type { UserStatus } from \'./artifacts.d.ts\'',
            ].join('\n'))
        })

        test('adds TypedDocumentNode import when operations are present', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(
                    new Map(),
                    new Map([
                        ['GetUserQuery', operation(OperationTypeNode.QUERY, [])],
                    ])
                ),
                new Map()
            )

            expect(result).toContain(
                '\timport type { TypedDocumentNode } from \'@graphql-typed-document-node/core\'\n'
            )
        })

        test('does not add TypedDocumentNode import when operations are absent', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(new Map()),
                new Map()
            )

            expect(result).not.toContain('TypedDocumentNode')
        })

        test('renders operation declarations with result, variables and typed document export', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(
                    new Map(),
                    new Map([
                        ['GetUserQuery', operation(
                            OperationTypeNode.QUERY,
                            [
                                field('user', objectValue([
                                    field('id', scalar('string'), false),
                                ])),
                            ],
                            [
                                inputField('id', {
                                    kind: VALUE_MODEL_KIND.SCALAR,
                                    typeTs: 'string',
                                }, false),
                                inputField('filter', inputObjectValue([
                                    inputField('status', {
                                        kind: VALUE_MODEL_KIND.ENUM,
                                        name: 'UserStatus',
                                    }),
                                ])),
                            ],
                            'Query'
                        )],
                    ])
                ),
                new Map([
                    ['UserStatus', './graphql.ts'],
                ])
            )

            expect(result).toContain([
                `\texport type GetUserQueryQuery = {`,
                `\t\t__typename?: 'Query';`,
                `\t\tuser: {`,
                `\t\t\tid: string;`,
                `\t\t} | null;`,
                `\t}`,
            ].join('\n'))
            expect(result).toContain([
                `\texport type GetUserQueryQueryVariables = Exact<{`,
                `\t\tid: string;`,
                `\t\tfilter?: {`,
                `\t\t\tstatus?: UserStatus | null;`,
                `\t\t} | null;`,
                `\t}>`,
            ].join('\n'))
            expect(result).toContain([
                `\texport const getUserQueryQuery: TypedDocumentNode<GetUserQueryQuery, GetUserQueryQueryVariables>`,
            ].join('\n'))
            expect(result).toContain([
                `\texport default getUserQueryQuery`,
            ].join('\n'))
        })

        test('renders required and optional input fields separately from nullability', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(
                    new Map(),
                    new Map([
                        ['UpdateUser', operation(
                            OperationTypeNode.MUTATION,
                            [],
                            [
                                inputField('input', inputObjectValue([
                                    inputField('name', {
                                        kind: VALUE_MODEL_KIND.SCALAR,
                                        typeTs: 'string',
                                    }, false, false, false),
                                    inputField('nickname', {
                                        kind: VALUE_MODEL_KIND.SCALAR,
                                        typeTs: 'string',
                                    }, true, false, true),
                                    inputField('locale', {
                                        kind: VALUE_MODEL_KIND.SCALAR,
                                        typeTs: 'string',
                                    }, true, false, false),
                                    inputField('token', {
                                        kind: VALUE_MODEL_KIND.SCALAR,
                                        typeTs: 'string',
                                    }, false, false, true),
                                ]), false, false, false),
                                inputField('traceId', {
                                    kind: VALUE_MODEL_KIND.SCALAR,
                                    typeTs: 'string',
                                }, true, false, true),
                            ],
                            'Mutation'
                        )],
                    ])
                ),
                new Map()
            )

            expect(result).toContain([
                '\texport type UpdateUserMutationVariables = Exact<{',
                '\t\tinput: {',
                '\t\t\tname: string;',
                '\t\t\tnickname?: string | null;',
                '\t\t\tlocale: string | null;',
                '\t\t\ttoken?: string;',
                '\t\t};',
                '\t\ttraceId?: string | null;',
                '\t}',
            ].join('\n'))
        })

        test('renders multiple fragments in declaration artifacts', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserCard', fragment([
                    field('id', scalar('string'), false),
                ], 'User')],
                ['PostCard', fragment([
                    field('title', scalar('string'), false),
                ], 'Post')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toBe([
                'declare module \'./documents\' {',
                '\texport type UserCard = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t}\n',
                '\texport type PostCard = {',
                `\t\t__typename?: 'Post';`,
                '\t\ttitle: string;',
                '\t}',
                '}',
            ].join('\n'))
        })
    })

    describe('scalar, enum and list fields', () => {
        test('renders nullable and non-null scalar fields', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserScalars', fragment([
                    field('id', scalar('string'), false),
                    field('nickname', scalar('string')),
                    field('rating', scalar('number'), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserScalars = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t\tnickname: string | null;',
                '\t\trating: number;',
            ].join('\n'))
        })

        test('renders enum fields with nullability preserved', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserEnums', fragment([
                    field('status', enumValue('UserStatus')),
                    field('role', enumValue('UserRole'), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserEnums = {',
                `\t\t__typename?: 'User';`,
                '\t\tstatus: UserStatus | null;',
                '\t\trole: UserRole;',
            ].join('\n'))
        })

        test('renders scalar and enum lists', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserLists', fragment([
                    field('tags', scalar('string'), false, true),
                    field('roles', enumValue('UserRole'), true, true),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserLists = {',
                `\t\t__typename?: 'User';`,
                '\t\ttags: Array<string>;',
                '\t\troles: Array<UserRole> | null;',
            ].join('\n'))
        })

        test('renders nullable list items separately from nullable list', () => {
            const definitions = declarationDefinitions(new Map([
                ['SparseLabels', fragment([
                    {
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: 'labels',
                        responseName: 'labels',
                        typeRef: {
                            kind: TYPE_REF_KIND.NON_NULL,
                            ofType: {
                                kind: TYPE_REF_KIND.LIST,
                                ofType: namedType(true),
                            },
                        },
                        value: scalar('string'),
                    },
                    {
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: 'strictLabels',
                        responseName: 'strictLabels',
                        typeRef: {
                            kind: TYPE_REF_KIND.LIST,
                            ofType: namedType(false),
                        },
                        value: scalar('string'),
                    },
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type SparseLabels = {',
                `\t\t__typename?: 'User';`,
                '\t\tlabels: Array<string | null>;',
                '\t\tstrictLabels: Array<string> | null;',
            ].join('\n'))
        })

        test('renders override types and non-null overrides from field model metadata', () => {
            const definitions = declarationDefinitions(new Map([
                ['OverrideUser', fragment([{
                    ...field('createdAt', scalar('string')),
                    overrideTypeTs: 'Date',
                    typeRef: {
                        kind: TYPE_REF_KIND.NON_NULL,
                        ofType: {
                            kind: TYPE_REF_KIND.NAMED,
                            name: 'String',
                        },
                    },
                }], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type OverrideUser = {',
                `\t\t__typename?: 'User';`,
                '\t\tcreatedAt: Date;',
            ].join('\n'))
        })
    })

    describe('object and union render', () => {
        test('renders object fields with nested scalars', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserProfile', fragment([
                    field('profile', objectValue([
                        field('bio', scalar('string')),
                        field('age', scalar('number'), false),
                    ], [ 'Profile' ]), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserProfile = {',
                `\t\t__typename?: 'User';`,
                '\t\tprofile: {',
                `\t\t\t__typename?: 'Profile';`,
                '\t\t\tbio: string | null;',
                '\t\t\tage: number;',
                '\t\t};',
            ].join('\n'))
        })

        test('renders optional typename for nested object fields when object runtime type is known', () => {
            const definitions = declarationDefinitions(new Map([
                ['RemoveGroupMutation', fragment([
                    field('removeGroup', objectValue([
                        field('id', scalar('string'), false),
                    ], [ 'RemoveGroupPayload' ]), false),
                ], 'Mutation')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type RemoveGroupMutation = {',
                `\t\t__typename?: 'Mutation';`,
                '\t\tremoveGroup: {',
                `\t\t\t__typename?: 'RemoveGroupPayload';`,
                '\t\t\tid: string;',
                '\t\t};',
            ].join('\n'))
        })

        test('omits nested typename when a nested spread already provides the same typename union', () => {
            const definitions = declarationDefinitions(new Map([
                ['ProfileDetails', {
                    onType: 'Profile',
                    onTypeNames: [ 'Profile' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('id', scalar('string'), false),
                        ],
                    },
                }],
                ['UserProfile', fragment([
                    field('profile', objectValue([
                        {
                            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                            name: 'ProfileDetails',
                            onType: 'Profile',
                            onTypeNames: [ 'Profile' ],
                        },
                    ], [ 'Profile' ]), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserProfile = {',
                `\t\t__typename?: 'User';`,
                '\t\tprofile: ProfileDetails;',
            ].join('\n'))
            expect(renderDeclaration('./documents', definitions, new Map())).not.toContain(`\t\t\t__typename?: 'Profile';`)
        })

        test('renders deeply nested object structures', () => {
            const definitions = declarationDefinitions(new Map([
                ['ProfileFragment', fragment([
                    field('profile', objectValue([
                        field('settings', objectValue([
                            field('theme', scalar('string')),
                            field('privacy', objectValue([
                                field('isPublic', scalar('boolean'), false),
                            ]), false),
                        ]), false),
                    ]), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type ProfileFragment = {',
                `\t\t__typename?: 'User';`,
                '\t\tprofile: {',
                '\t\t\tsettings: {',
                '\t\t\t\ttheme: string | null;',
                '\t\t\t\tprivacy: {',
                '\t\t\t\t\tisPublic: boolean;',
                '\t\t\t\t};',
                '\t\t\t};',
                '\t\t};',
            ].join('\n'))
        })

        test('renders lists of object fields', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserFriends', fragment([
                    field('friends', objectValue([
                        field('id', scalar('string'), false),
                        field('name', scalar('string')),
                    ]), false, true),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserFriends = {',
                `\t\t__typename?: 'User';`,
                '\t\tfriends: Array<{',
                '\t\t\tid: string;',
                '\t\t\tname: string | null;',
                '\t\t}>;',
            ].join('\n'))
        })

        test('renders nested arrays across object boundaries', () => {
            const definitions = declarationDefinitions(new Map([
                ['NestedArrays', fragment([
                    field('groups', objectValue([
                        field('members', objectValue([
                            field('id', scalar('string'), false),
                            field('labels', scalar('string'), true, true),
                        ]), false, true),
                        field('tags', enumValue('GroupTag'), false, true),
                    ]), false, true),
                ], 'Query')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type NestedArrays = {',
                `\t\t__typename?: 'Query';`,
                '\t\tgroups: Array<{',
                '\t\t\tmembers: Array<{',
                '\t\t\t\tid: string;',
                '\t\t\t\tlabels: Array<string> | null;',
                '\t\t\t}>;',
                '\t\t\ttags: Array<GroupTag>;',
                '\t\t}>;',
            ].join('\n'))
        })

        test('renders union fields with multiple variants', () => {
            const definitions = declarationDefinitions(new Map([
                ['SearchResult', fragment([
                    field('search', unionValue([
                        {
                            typeName: 'User',
                            fields: [
                                field('email', scalar('string'), false),
                                field('status', enumValue('UserStatus')),
                            ],
                        },
                        {
                            typeName: 'Guest',
                            fields: [
                                field('nickname', scalar('string')),
                            ],
                        },
                    ]), false),
                ], 'Query')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain(
                [
                    '\texport type SearchResult = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\tsearch: {',
                    `\t\t\t__typename: 'User';`,
                    '\t\t\temail: string;',
                    '\t\t\tstatus: UserStatus | null;',
                    '\t\t} | {',
                    `\t\t\t__typename: 'Guest';`,
                    '\t\t\tnickname: string | null;',
                    '\t\t};',
                ].join('\n')
            )
        })

        test('renders union fields without specialized variants as never', () => {
            const definitions = declarationDefinitions(new Map([
                ['SearchResultTypenameOnly', fragment([
                    field('search', unionValue([]), false),
                ], 'Query')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type SearchResultTypenameOnly = {',
                `\t\t__typename?: 'Query';`,
                '\t\tsearch: never;',
            ].join('\n'))
        })

        test('renders nullable object-like values as union with null', () => {
            const definitions = declarationDefinitions(new Map([
                ['NullableOwner', fragment([
                    field('owner', objectValue([
                        field('id', scalar('string'), false),
                        field('username', scalar('string'), false),
                    ])),
                ], 'Group')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type NullableOwner = {',
                `\t\t__typename?: 'Group';`,
                '\t\towner: {',
                '\t\t\tid: string;',
                '\t\t\tusername: string;',
                '\t\t} | null;',
            ].join('\n'))
        })

        test('renders fragment root as union when concrete variants are provided', () => {
            const definitions = declarationDefinitions(new Map([
                ['PolymorphicUser', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.UNION,
                        variants: [
                            {
                                typeName: 'UserPayload',
                                fields: [
                                    field('id', scalar('string'), false),
                                    field('permissions', scalar('Array<string>'), false),
                                ],
                            },
                            {
                                typeName: 'AdminPayload',
                                fields: [
                                    field('id', scalar('string'), false),
                                    field('role', scalar('string'), false),
                                ],
                            },
                        ],
                    },
                }],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type PolymorphicUser = {',
                `\t\t__typename?: 'UserPayload';`,
                '\t\tid: string;',
                '\t\tpermissions: Array<string>;',
                '\t} | {',
                `\t\t__typename?: 'AdminPayload';`,
                '\t\tid: string;',
                '\t\trole: string;',
                '\t}',
            ].join('\n'))
        })
    })

    describe('typename handling', () => {
        test('uses explicit __typename without duplicating root typename', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserTypename', fragment([
                    field('__typename', typenameValue('User'), false),
                    field('id', scalar('string'), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserTypename = {',
                `\t\t__typename: 'User';`,
                '\t\tid: string;',
            ].join('\n'))
        })

        test('uses aliased __typename instead of fallback typename for concrete object roots', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserKind', fragment([{
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: '__typename',
                    responseName: 'kind',
                    typeRef: {
                        kind: TYPE_REF_KIND.NON_NULL,
                        ofType: {
                            kind: TYPE_REF_KIND.NAMED,
                            name: 'String',
                        },
                    },
                    value: typenameValue('User'),
                    directives: [],
                }], 'User')],
            ]))

            const result = renderDeclaration('./documents', definitions, new Map())

            expect(result).toContain([
                '\texport type UserKind = {',
                `\t\tkind: 'User';`,
            ].join('\n'))
            expect(result).not.toContain(`\t\t__typename?: 'User';`)
        })

        test('suppresses fallback typename for nested concrete object values with aliased __typename', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserKind', fragment([
                    field('profile', objectValue([{
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: '__typename',
                        responseName: 'kind',
                        typeRef: {
                            kind: TYPE_REF_KIND.NON_NULL,
                            ofType: {
                                kind: TYPE_REF_KIND.NAMED,
                                name: 'String',
                            },
                        },
                        value: typenameValue('Profile'),
                        directives: [],
                    }], [ 'Profile' ]), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserKind = {',
                `\t\t__typename?: 'User';`,
                '\t\tprofile: {',
                `\t\t\tkind: 'Profile';`,
                '\t\t};',
            ].join('\n'))
            expect(renderDeclaration('./documents', definitions, new Map())).not.toContain(`\t\t\t__typename?: 'Profile';`)
        })

        test('does not duplicate typename when it is returned from an inline fragment on the same level', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserTypenameFromInline', fragment([
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'User',
                        selections: [
                            field('__typename', typenameValue('User'), false),
                        ],
                    },
                    field('id', scalar('string'), false),
                ], 'User')],
            ]))

            const result = renderDeclaration('./documents', definitions, new Map())

            expect(result).toContain([
                '\texport type UserTypenameFromInline = {',
                `\t\t__typename: 'User';`,
                '\t\tid: string;',
            ].join('\n'))
            expect(result).not.toContain(`\t\t__typename?: 'User';`)
        })

        test('does not duplicate explicit typename inside fragment root variants', () => {
            const definitions = declarationDefinitions(new Map([
                ['ExplicitPolymorphicUser', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.UNION,
                        variants: [
                            {
                                typeName: 'UserPayload',
                                fields: [
                                    field('__typename', typenameValue('UserPayload'), false),
                                    field('id', scalar('string'), false),
                                ],
                            },
                            {
                                typeName: 'AdminPayload',
                                fields: [
                                    field('__typename', typenameValue('AdminPayload'), false),
                                    field('id', scalar('string'), false),
                                ],
                            },
                        ],
                    },
                }],
            ]))

            const result = renderDeclaration('./documents', definitions, new Map())

            expect(result).toContain([
                '\texport type ExplicitPolymorphicUser = {',
                `\t\t__typename: 'UserPayload';`,
                '\t\tid: string;',
                '\t} | {',
                `\t\t__typename: 'AdminPayload';`,
                '\t\tid: string;',
                '\t}',
            ].join('\n'))
        })

        test('omits root typename when a spread already provides the same typename union', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserDetails', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('id', scalar('string'), false),
                        ],
                    },
                }],
                ['UserWithGroups', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserDetails',
                                onType: 'User',
                                onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                            },
                            field('groups', scalar('GroupDetails'), false, true),
                        ],
                    },
                }],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserWithGroups = {',
                '\t\tgroups: Array<GroupDetails>;',
                '\t} & UserDetails',
            ].join('\n'))
        })

        test('does not omit root typename when matching spread is conditional', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserDetails', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('id', scalar('string'), false),
                        ],
                    },
                }],
                ['UserWithConditionalGroups', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserDetails',
                                onType: 'User',
                                onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                                conditional: true,
                                directives: [ 'include' ],
                            },
                            field('groups', scalar('GroupDetails'), false, true),
                        ],
                    },
                }],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserWithConditionalGroups = {',
                `\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                '\t\tgroups: Array<GroupDetails>;',
                '\t} & Partial<UserDetails>',
            ].join('\n'))
        })

        test('omits root typename when fragment is rendered as object intersected with two spreads', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserDetails', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('id', scalar('string'), false),
                        ],
                    },
                }],
                ['UserPresence', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('isOnline', scalar('boolean'), false),
                        ],
                    },
                }],
                ['UserWithGroups', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserDetails',
                                onType: 'User',
                                onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                            },
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserPresence',
                                onType: 'User',
                                onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                            },
                            field('groups', scalar('GroupDetails'), false, true),
                        ],
                    },
                }],
            ]))

            const result = renderDeclaration('./documents', definitions, new Map())

            expect(result).toContain([
                '\texport type UserWithGroups = {',
                '\t\tgroups: Array<GroupDetails>;',
                '\t} & UserDetails & UserPresence',
            ].join('\n'))
        })

        test('keeps root typename when fragment is rendered as object intersected with spreads having different typename unions', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserDetails', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('id', scalar('string'), false),
                        ],
                    },
                }],
                ['UserPresence', {
                    onType: 'User',
                    onTypeNames: [ 'ModeratorPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('isOnline', scalar('boolean'), false),
                        ],
                    },
                }],
                ['UserWithGroups', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserDetails',
                                onType: 'User',
                                onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                            },
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserPresence',
                                onType: 'User',
                                onTypeNames: [ 'ModeratorPayload', 'AdminPayload' ],
                            },
                            field('groups', scalar('GroupDetails'), false, true),
                        ],
                    },
                }],
            ]))

            const result = renderDeclaration('./documents', definitions, new Map())

            expect(result).toContain([
                '\texport type UserWithGroups = {',
                `\t\t__typename?: 'UserPayload' | 'AdminPayload';`,
                '\t\tgroups: Array<GroupDetails>;',
                '\t} & UserDetails & UserPresence',
            ].join('\n'))
        })
    })

    describe('fragments and conditional selections', () => {
        test('renders inline fragment selections as sibling fields', () => {
            const definitions = declarationDefinitions(new Map([
                ['AdminUser', fragment([
                    field('id', scalar('string'), false),
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'Admin',
                        selections: [
                            field('permissions', scalar('string'), false, true),
                            field('isOwner', scalar('boolean'), false),
                        ],
                    },
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type AdminUser = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t\tpermissions: Array<string>;',
                '\t\tisOwner: boolean;',
            ].join('\n'))
        })

        test('renders fragment spread rows literal', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserWithSpread', fragment([
                    field('id', scalar('string'), false),
                    {
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'SharedFields',
                        onType: 'User',
                    },
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserWithSpread = {',
                '\t\tid: string;',
                '\t} & SharedFields',
            ].join('\n'))
        })

        test('renders conditional fields as optional properties', () => {
            const definitions = declarationDefinitions(new Map([
                ['ConditionalUser', fragment([
                    field('id', scalar('string'), false),
                    {
                        ...field('nickname', scalar('string')),
                        conditional: true,
                        directives: [ 'include' ],
                    },
                    {
                        ...field('email', scalar('string'), false),
                        conditional: true,
                        directives: [ 'skip' ],
                    },
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type ConditionalUser = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t\tnickname?: string | null;',
                '\t\temail?: string;',
            ].join('\n'))
        })

        test('renders statically included selections as regular properties', () => {
            const definitions = declarationDefinitions(new Map([
                ['StaticUser', fragment([
                    field('id', scalar('string'), false),
                    field('email', scalar('string')),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type StaticUser = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t\temail: string | null;',
            ].join('\n'))
        })

        test('renders conditional fragment spreads as Partial intersections', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserWithConditionalSpread', fragment([
                    field('id', scalar('string'), false),
                    {
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'SharedFields',
                        onType: 'User',
                        conditional: true,
                        directives: [ 'include' ],
                    },
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserWithConditionalSpread = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t} & Partial<SharedFields>',
            ].join('\n'))
        })

        test('renders fields from conditional inline fragments as optional properties', () => {
            const definitions = declarationDefinitions(new Map([
                ['ConditionalAdminUser', fragment([
                    field('id', scalar('string'), false),
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'Admin',
                        conditional: true,
                        directives: [ 'skip' ],
                        selections: [
                            field('permissions', scalar('string'), false, true),
                            field('isOwner', scalar('boolean'), false),
                        ],
                    },
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type ConditionalAdminUser = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
                '\t\tpermissions?: Array<string>;',
                '\t\tisOwner?: boolean;',
            ].join('\n'))
        })

        test('renders nested fragment spreads inside object fields', () => {
            const definitions = declarationDefinitions(new Map([
                ['NestedSpreadContainer', fragment([
                    field('profile', objectValue([
                        field('id', scalar('string'), false),
                        {
                            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                            name: 'ProfileDetails',
                            onType: 'Profile',
                        },
                        field('contacts', objectValue([
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'ContactFields',
                                onType: 'Contact',
                            },
                        ]), false, true),
                    ]), false),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type NestedSpreadContainer = {',
                `\t\t__typename?: 'User';`,
                '\t\tprofile: {',
                '\t\t\tid: string;',
                '\t\t\tcontacts: Array<ContactFields>;',
                '\t\t} & ProfileDetails;',
            ].join('\n'))
        })
    })

    describe('complex declarations and fallback behavior', () => {
        test('renders mixed nested structures in one fragment', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserDetails', fragment([
                    field('id', scalar('string'), false),
                    field('status', enumValue('UserStatus')),
                    field('tags', scalar('string'), false, true),
                    field('profile', objectValue([
                        field('bio', scalar('string')),
                    ]), false),
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'Admin',
                        selections: [
                            field('role', scalar('string'), false),
                        ],
                    },
                    {
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'SharedFields',
                        onType: 'User',
                    },
                    field('search', unionValue([
                        {
                            typeName: 'User',
                            fields: [field('email', scalar('string'), false)],
                        },
                        {
                            typeName: 'Guest',
                            fields: [field('nickname', scalar('string'))],
                        },
                    ]), false),
                ], 'User')],
            ]))

            const importsMap = new Map([
                ['UserStatus', './artifacts.d.ts'],
                ['SharedFields', './fragments/SharedFields.graphql'],
            ])

            expect(renderDeclaration('./documents', definitions, importsMap)).toBe([
                'declare module \'./documents\' {',
                '\timport type { SharedFields } from \'./fragments/SharedFields.graphql\'',
                '\timport type { UserStatus } from \'./artifacts.d.ts\'\n',
                '\texport type UserDetails = {',
                '\t\tid: string;',
                '\t\tstatus: UserStatus | null;',
                '\t\ttags: Array<string>;',
                '\t\tprofile: {',
                '\t\t\tbio: string | null;',
                '\t\t};',
                '\t\trole: string;',
                '\t\tsearch: {',
                `\t\t\t__typename: 'User';`,
                '\t\t\temail: string;',
                '\t\t} | {',
                `\t\t\t__typename: 'Guest';`,
                '\t\t\tnickname: string | null;',
                '\t\t};',
                '\t} & SharedFields',
                '}',
            ].join('\n'))
        })

        test('renders unknown field values as unknown and warns once', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
            const definitions = declarationDefinitions(new Map([
                ['BrokenFragment', fragment([
                    field('mystery', {
                        kind: VALUE_MODEL_KIND.UNKNOWN,
                        reason: 'unsupported',
                    }),
                ], 'BrokenFragment')],
            ]))

            const result = renderDeclaration('./documents', definitions, new Map())

            expect(result).toContain('\t\tmystery: unknown | null;')
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith('Unknown type')

            warn.mockRestore()
        })
    })
})
