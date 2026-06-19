import type { NamingConvention } from '../../../src/naming'

import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { createNamingConvention } from '../../../src/naming'
import { makeGenerationDirectivePolicies } from '../../../src/directives/structural-policies'
import { makePlannedDocumentModels } from '../../../src/plan/planned'
import { prepareRenderableDocumentModels } from '../../../src/plan/renderable/prepare-models'
import { renderDeclaration as renderPlannedDeclaration } from '../../../src/render/declarations'

import {
    arrayOf,
    defineBoolean,
    defineNamed,
    defineNull,
    defineNumber,
    defineString,
    unionOf,
} from '../../../src'

import {
    declarationDefinitions,
    enumValue,
    field,
    fragment,
    namedType,
    objectValue,
    operation,
    scalar,
    typenameValue,
    unionValue,
    variableField,
    variableObjectValue,
    variableScalar,
} from '../../fixtures/builders/declaration-render'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'

import { OperationTypeNode } from 'graphql'

const renderDeclaration = (
    path: string,
    definitions: ReturnType<typeof declarationDefinitions>,
    importsMap: Map<string, string>,
    naming: NamingConvention = createNamingConvention()
): string => {
    return renderPlannedDeclaration(
        path,
        prepareRenderableDocumentModels(
            makePlannedDocumentModels(
                definitions,
                [ ...importsMap.keys() ],
                definitions.customScalars,
                naming,
                makeGenerationDirectivePolicies(definitions.directivePolicies)
            )
        ),
        importsMap,
        naming
    )
}

describe('declaration render', () => {
    describe('imports and module wrapper', () => {
        test('sorts imports alphabetically', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(new Map([
                    ['UserScalars', fragment([
                        field('id', scalar(defineString()), false),
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
            expect(result).not.toContain('import type { Exact }')
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
                                    field('id', scalar(defineString()), false),
                                ])),
                            ],
                            [
                                variableField('id', variableScalar(defineString()), false),
                                variableField('filter', variableObjectValue([
                                    variableField('status', {
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
                `\texport type GetUserQueryQueryPayload = {`,
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
                `\texport const getUserQueryQuery: TypedDocumentNode<GetUserQueryQueryPayload, GetUserQueryQueryVariables>`,
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
                                variableField('input', variableObjectValue([
                                    variableField('name', variableScalar(defineString()), false, false, false),
                                    variableField('nickname', variableScalar(defineString()), true, false, true),
                                    variableField('locale', variableScalar(defineString()), true, false, false),
                                    variableField('token', variableScalar(defineString()), false, false, true),
                                ]), false, false, false),
                                variableField('traceId', variableScalar(defineString()), true, false, true),
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

        test('renders unknown operation variable values as unknown and warns once', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
            const definitions = declarationDefinitions(
                new Map(),
                new Map([
                    ['Search', operation(
                        OperationTypeNode.QUERY,
                        [],
                        [
                            variableField('filter', {
                                kind: VALUE_MODEL_KIND.UNKNOWN,
                                reason: 'unsupported',
                            }),
                        ],
                        'Query'
                    )],
                ])
            )

            const result = renderPlannedDeclaration(
                './documents',
                prepareRenderableDocumentModels(
                    makePlannedDocumentModels(
                        definitions,
                        [],
                        definitions.customScalars,
                        createNamingConvention(),
                        makeGenerationDirectivePolicies(definitions.directivePolicies)
                    )
                ),
                new Map(),
                createNamingConvention()
            )

            expect(result).toContain([
                '\texport type SearchQueryVariables = Exact<{',
                '\t\tfilter?: unknown | null;',
                '\t}>',
            ].join('\n'))

            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith('Unknown variable type')

            warn.mockRestore()
        })

        test('renders operation variables without Exact when the operation has no variables', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(
                    new Map(),
                    new Map([
                        ['UsersListQuery', operation(
                            OperationTypeNode.QUERY,
                            [],
                            [],
                            'Query'
                        )],
                    ])
                ),
                new Map()
            )

            expect(result).toContain(`\texport type UsersListQueryQueryVariables = { [key: string]: never }`)
            expect(result).not.toContain('Exact<{ [key: string]: never }>')
        })

        test('renders operation declaration names with configured operation naming', () => {
            const result = renderDeclaration(
                './documents',
                declarationDefinitions(
                    new Map(),
                    new Map([
                        ['get_user', operation(
                            OperationTypeNode.QUERY,
                            [],
                            [],
                            'Query'
                        )],
                    ])
                ),
                new Map(),
                createNamingConvention({
                    operationNames: 'camelCase',
                })
            )

            expect(result).toContain(`\texport type getUserQueryVariables = { [key: string]: never }`)
            expect(result).toContain(`\texport type getUserQueryPayload = {`)
            expect(result).toContain(`\texport const getUserQuery: TypedDocumentNode<getUserQueryPayload, getUserQueryVariables>`)
            expect(result).toContain(`\texport default getUserQuery`)
        })

        describe('variable aliases', () => {
            test('renders recursive input object variables through named aliases', () => {
                const treeInput = variableObjectValue([
                    variableField('value', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                ], 'TreeInput')

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map(),
                        new Map([
                            ['CreateTree', operation(
                                OperationTypeNode.MUTATION,
                                [],
                                [ variableField('input', treeInput, false, false, false) ],
                                'Mutation'
                            )],
                        ])
                    ),
                    new Map()
                )

                expect(result).toContain([
                    '\ttype TreeInputAlias = {',
                    '\t\tvalue?: string | null;',
                    '\t\tchildren?: Array<TreeInputAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type CreateTreeMutationVariables = Exact<{',
                    '\t\tinput: TreeInputAlias;',
                    '\t}>',
                ].join('\n'))
            })

            test('avoids collisions between variable aliases and fragment exports', () => {
                const treeInput = variableObjectValue([
                    variableField('value', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                ], 'TreeInput')

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map([
                            ['TreeInputAlias', fragment([
                                field('id', scalar(defineString()), false),
                            ], 'User')],
                        ]),
                        new Map([
                            ['CreateTree', operation(
                                OperationTypeNode.MUTATION,
                                [],
                                [ variableField('input', treeInput, false, false, false) ],
                                'Mutation'
                            )],
                        ])
                    ),
                    new Map()
                )

                expect(result).toContain([
                    '\texport type TreeInputAlias = {',
                    `\t\t__typename?: 'User';`,
                    '\t\tid: string;',
                    '\t}',
                ].join('\n'))

                const aliasName = result.match(/type (TreeInputAlias_[a-f0-9]{4}) =/)?.[1]

                expect(aliasName).toBeDefined()
                expect(result).toContain([
                    `\ttype ${aliasName} = {`,
                    '\t\tvalue?: string | null;',
                    `\t\tchildren?: Array<${aliasName}> | null;`,
                    '\t}',
                ].join('\n'))

                expect(result).toContain([
                    '\texport type CreateTreeMutationVariables = Exact<{',
                    `\t\tinput: ${aliasName};`,
                    '\t}>',
                ].join('\n'))
            })

            test('uses a hash when a variable alias base name is occupied by an imported type', () => {
                const treeInput = variableObjectValue([
                    variableField('value', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                ], 'TreeInput')

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map(),
                        new Map([
                            ['CreateTree', operation(
                                OperationTypeNode.MUTATION,
                                [],
                                [ variableField('input', treeInput, false, false, false) ],
                                'Mutation'
                            )],
                        ])
                    ),
                    new Map([['TreeInputAlias', './tree-input']])
                )
                const aliasName = result.match(/type (TreeInputAlias_[a-f0-9]{4}) =/)?.[1]

                expect(aliasName).toBeDefined()
                expect(result).toContain(`\timport type { TreeInputAlias } from './tree-input'`)
                expect(result).toContain([
                    `\ttype ${aliasName} = {`,
                    '\t\tvalue?: string | null;',
                    `\t\tchildren?: Array<${aliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type CreateTreeMutationVariables = Exact<{',
                    `\t\tinput: ${aliasName};`,
                    '\t}>',
                ].join('\n'))
            })

            test('avoids collisions between variable aliases with the same base name', () => {
                const treeInput = variableObjectValue([
                    variableField('value', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                ], 'TreeInput')
                const tree = variableObjectValue([
                    variableField('label', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'Tree', true), true, true),
                ], 'Tree')

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map(),
                        new Map([
                            ['CreateTrees', operation(
                                OperationTypeNode.MUTATION,
                                [],
                                [
                                    variableField('input', treeInput, false, false, false),
                                    variableField('legacyInput', tree, false, false, false),
                                ],
                                'Mutation'
                            )],
                        ])
                    ),
                    new Map()
                )
                const legacyAliasName = result.match(/type (TreeInputAlias_[a-f0-9]{4}) =/)?.[1]

                expect(legacyAliasName).toBeDefined()
                expect(result).toContain([
                    '\ttype TreeInputAlias = {',
                    '\t\tvalue?: string | null;',
                    '\t\tchildren?: Array<TreeInputAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    `\ttype ${legacyAliasName} = {`,
                    '\t\tlabel?: string | null;',
                    `\t\tchildren?: Array<${legacyAliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type CreateTreesMutationVariables = Exact<{',
                    '\t\tinput: TreeInputAlias;',
                    `\t\tlegacyInput: ${legacyAliasName};`,
                    '\t}>',
                ].join('\n'))
            })

            test('preserves variable field order in alias declarations', () => {
                const renderWithTreeInputFields = (fields: ReturnType<typeof variableField>[]): string =>
                    renderDeclaration(
                        './documents',
                        declarationDefinitions(
                            new Map(),
                            new Map([
                                ['CreateTree', operation(
                                    OperationTypeNode.MUTATION,
                                    [],
                                    [ variableField('input', variableObjectValue(fields, 'TreeInput'), false, false, false) ],
                                    'Mutation'
                                )],
                            ])
                        ),
                        new Map([['TreeInputAlias', './tree-input']])
                    )
                const extractAliasName = (result: string): string | undefined =>
                    result.match(/type (TreeInputAlias_[a-f0-9]{4}) =/)?.[1]

                const valueFirstResult = renderWithTreeInputFields([
                    variableField('value', variableScalar(defineString())),
                    variableField('label', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                ])
                const labelFirstResult = renderWithTreeInputFields([
                    variableField('label', variableScalar(defineString())),
                    variableField('value', variableScalar(defineString())),
                    variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                ])
                const valueFirstAliasName = extractAliasName(valueFirstResult)
                const labelFirstAliasName = extractAliasName(labelFirstResult)

                expect(valueFirstAliasName).toBeDefined()
                expect(labelFirstAliasName).toBeDefined()

                expect(valueFirstResult).toContain([
                    `\ttype ${valueFirstAliasName} = {`,
                    '\t\tvalue?: string | null;',
                    '\t\tlabel?: string | null;',
                    `\t\tchildren?: Array<${valueFirstAliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(labelFirstResult).toContain([
                    `\ttype ${labelFirstAliasName} = {`,
                    '\t\tlabel?: string | null;',
                    '\t\tvalue?: string | null;',
                    `\t\tchildren?: Array<${labelFirstAliasName}> | null;`,
                    '\t}',
                ].join('\n'))
            })

            test('expands variable alias hash length and falls back to indexed full-hash names', () => {
                const extractRecursiveTreeInputAlias = (result: string): string | undefined =>
                    result.match(
                        /\ttype (TreeInputAlias_[a-f0-9]{4,8}(?:\d+)?) = \{\n\t\tvalue\?: string \| null;\n\t\tchildren\?: Array<\1> \| null;\n\t\}/
                    )?.[1]
                const expectRecursiveTreeInputAlias = (result: string, aliasName: string | undefined) => {
                    expect(result).toContain([
                        `\ttype ${aliasName} = {`,
                        '\t\tvalue?: string | null;',
                        `\t\tchildren?: Array<${aliasName}> | null;`,
                        '\t}',
                    ].join('\n'))
                }

                const renderWithOccupiedAliases = (occupiedAliasNames: string[]): string => {
                    const treeInput = variableObjectValue([
                        variableField('value', variableScalar(defineString())),
                        variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
                    ], 'TreeInput')

                    return renderDeclaration(
                        './documents',
                        declarationDefinitions(
                            new Map(occupiedAliasNames.map(name => [name, fragment([
                                field('id', scalar(defineString()), false),
                            ], 'User')] as const)),
                            new Map([
                                ['CreateTree', operation(
                                    OperationTypeNode.MUTATION,
                                    [],
                                    [ variableField('input', treeInput, false, false, false) ],
                                    'Mutation'
                                )],
                            ])
                        ),
                        new Map()
                    )
                }

                const occupiedAliasNames = ['TreeInputAlias']
                const allocatedAliasNames = [4, 5, 6, 7, 8].map(hashLength => {
                    const result = renderWithOccupiedAliases(occupiedAliasNames)
                    const aliasName = extractRecursiveTreeInputAlias(result)

                    expect(aliasName).toMatch(new RegExp(`^TreeInputAlias_[a-f0-9]{${hashLength}}$`))
                    expectRecursiveTreeInputAlias(result, aliasName)

                    occupiedAliasNames.push(aliasName as string)
                    return aliasName
                })

                const fullHashAliasName = allocatedAliasNames[allocatedAliasNames.length - 1]
                const firstIndexedResult = renderWithOccupiedAliases(occupiedAliasNames)
                const firstIndexedAliasName = extractRecursiveTreeInputAlias(firstIndexedResult)

                expect(firstIndexedAliasName).toBe(`${fullHashAliasName}2`)
                expectRecursiveTreeInputAlias(firstIndexedResult, firstIndexedAliasName)

                occupiedAliasNames.push(firstIndexedAliasName as string)

                const secondIndexedResult = renderWithOccupiedAliases(occupiedAliasNames)
                const secondIndexedAliasName = extractRecursiveTreeInputAlias(secondIndexedResult)

                expect(secondIndexedAliasName).toBe(`${fullHashAliasName}3`)
                expectRecursiveTreeInputAlias(secondIndexedResult, secondIndexedAliasName)
            })

            test('keeps matching variable and output alias structures separate', () => {
                const recursiveInput = variableObjectValue([], 'ObjectInput')
                recursiveInput.fields.push(
                    variableField('value', variableScalar(defineString()), true, false, false),
                    variableField('children', variableObjectValue([], 'ObjectInput', true), true, true, false)
                )

                const recursiveOutput = objectValue([])
                recursiveOutput.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveOutput, true, true)
                )

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map(),
                        new Map([
                            ['SyncObject', operation(
                                OperationTypeNode.MUTATION,
                                [ field('node', recursiveOutput, false) ],
                                [ variableField('input', recursiveInput, false, false, false) ],
                                'Mutation'
                            )],
                        ])
                    ),
                    new Map()
                )

                expect(result).toContain([
                    '\ttype ObjectInputAlias = {',
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<ObjectInputAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\ttype ObjectAlias = {',
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<ObjectAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type SyncObjectMutationVariables = Exact<{',
                    '\t\tinput: ObjectInputAlias;',
                    '\t}>',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type SyncObjectMutationPayload = {',
                    `\t\t__typename?: 'Mutation';`,
                    '\t\tnode: ObjectAlias;',
                    '\t}',
                ].join('\n'))
            })
        })

        test('renders multiple fragments in declaration artifacts', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserCard', fragment([
                    field('id', scalar(defineString()), false),
                ], 'User')],
                ['PostCard', fragment([
                    field('title', scalar(defineString()), false),
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
                    field('id', scalar(defineString()), false),
                    field('nickname', scalar(defineString())),
                    field('rating', scalar(defineNumber()), false),
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

        test('does not duplicate null when a scalar type already includes it', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserNullableScalar', fragment([
                    field('nickname', scalar(unionOf(defineNamed('Date'), defineNull()))),
                    field('tags', scalar(arrayOf(unionOf(defineString(), defineNull())))),
                ], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type UserNullableScalar = {',
                `\t\t__typename?: 'User';`,
                '\t\tnickname: Date | null;',
                '\t\ttags: Array<string | null> | null;',
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
                    field('tags', scalar(defineString()), false, true),
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
                        argumentsSignature: '',
                        conditional: false,
                        typeRef: {
                            kind: TYPE_REF_KIND.NON_NULL,
                            ofType: {
                                kind: TYPE_REF_KIND.LIST,
                                ofType: namedType(true),
                            },
                        },
                        value: scalar(defineString()),
                    },
                    {
                        kind: SELECTION_MODEL_KIND.FIELD,
                        name: 'strictLabels',
                        responseName: 'strictLabels',
                        argumentsSignature: '',
                        conditional: false,
                        typeRef: {
                            kind: TYPE_REF_KIND.LIST,
                            ofType: namedType(false),
                        },
                        value: scalar(defineString()),
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

        test('unwraps nested non-null field type references', () => {
            const definitions = declarationDefinitions(new Map([
                ['StrictUser', fragment([{
                    kind: SELECTION_MODEL_KIND.FIELD,
                    name: 'id',
                    responseName: 'id',
                    argumentsSignature: '',
                    conditional: false,
                    typeRef: {
                        kind: TYPE_REF_KIND.NON_NULL,
                        ofType: {
                            kind: TYPE_REF_KIND.NON_NULL,
                            ofType: {
                                kind: TYPE_REF_KIND.NAMED,
                                name: 'String',
                            },
                        },
                    },
                    value: scalar(defineString()),
                }], 'User')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type StrictUser = {',
                `\t\t__typename?: 'User';`,
                '\t\tid: string;',
            ].join('\n'))
        })

        test('renders override types and non-null overrides from field model metadata', () => {
            const definitions = declarationDefinitions(new Map([
                ['OverrideUser', fragment([{
                    ...field('createdAt', scalar(defineString())),
                    directiveNames: [ 'opaque' ],
                    typeRef: {
                        kind: TYPE_REF_KIND.NON_NULL,
                        ofType: {
                            kind: TYPE_REF_KIND.NAMED,
                            name: 'String',
                        },
                    },
                }], 'User')],
            ]), new Map(), {
                opaque: {
                    effect: 'override-type',
                    type: defineNamed('Date'),
                },
            })

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
                        field('bio', scalar(defineString())),
                        field('age', scalar(defineNumber()), false),
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
                        field('id', scalar(defineString()), false),
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
                            field('id', scalar(defineString()), false),
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
                            conditional: false,
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
                            field('theme', scalar(defineString())),
                            field('privacy', objectValue([
                                field('isPublic', scalar(defineBoolean()), false),
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

        describe('output aliases', () => {
            test('renders recursive result objects through named aliases', () => {
                const recursiveTree = objectValue([], [ 'Tree' ])
                recursiveTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveTree, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['TreeFragment', fragment([
                        field('node', recursiveTree, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())

                expect(result).toContain([
                    '\ttype TreeAlias = {',
                    `\t\t__typename?: 'Tree';`,
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<TreeAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type TreeFragment = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\tnode: TreeAlias;',
                    '\t}',
                ].join('\n'))
            })

            test('reuses recursive result aliases for structurally equal shapes from different instances', () => {
                const leftTree = objectValue([], [ 'Tree' ])
                leftTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', leftTree, true, true)
                )

                const rightTree = objectValue([], [ 'Tree' ])
                rightTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', rightTree, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['TreeFragment', fragment([
                        field('left', leftTree, false),
                        field('right', rightTree, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())

                expect(result).toContain(`\ttype TreeAlias = {`)
                expect(result).toContain(`\t\tleft: TreeAlias;`)
                expect(result).toContain(`\t\tright: TreeAlias;`)
                expect(result.match(/type TreeAlias =/g)).toHaveLength(1)
            })

            test('keeps output alias names independent from operation and fragment names', () => {
                const fragmentTree = objectValue([], [ 'Tree' ])
                fragmentTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', fragmentTree, true, true)
                )

                const operationTree = objectValue([], [ 'Tree' ])
                operationTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', operationTree, true, true)
                )

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map([
                            ['TreeCard', fragment([
                                field('root', fragmentTree, false),
                            ], 'Query')],
                        ]),
                        new Map([
                            ['LoadRoot', operation(
                                OperationTypeNode.QUERY,
                                [ field('root', operationTree, false) ],
                                [],
                                'Query'
                            )],
                        ])
                    ),
                    new Map()
                )

                expect(result).toContain([
                    '\ttype TreeAlias = {',
                    `\t\t__typename?: 'Tree';`,
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<TreeAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type TreeCard = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\troot: TreeAlias;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type LoadRootQueryPayload = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\troot: TreeAlias;',
                    '\t}',
                ].join('\n'))
                expect(result.match(/type TreeAlias =/g)).toHaveLength(1)
            })

            test('reuses aliases for repeated non-recursive result object shapes', () => {
                const definitions = declarationDefinitions(new Map([
                    ['ProfilePair', fragment([
                        field('primaryProfile', objectValue([
                            field('id', scalar(defineString()), false),
                            field('name', scalar(defineString())),
                        ], [ 'Profile' ]), false),
                        field('secondaryProfile', objectValue([
                            field('id', scalar(defineString()), false),
                            field('name', scalar(defineString())),
                        ], [ 'Profile' ]), false),
                    ], 'User')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())

                expect(result).toContain([
                    '\ttype ProfileAlias = {',
                    `\t\t__typename?: 'Profile';`,
                    '\t\tid: string;',
                    '\t\tname: string | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type ProfilePair = {',
                    `\t\t__typename?: 'User';`,
                    '\t\tprimaryProfile: ProfileAlias;',
                    '\t\tsecondaryProfile: ProfileAlias;',
                    '\t}',
                ].join('\n'))
                expect(result.match(/type ProfileAlias =/g)).toHaveLength(1)
            })

            test('keeps similar recursive result object shapes separate', () => {
                const valueTree = objectValue([], [ 'Tree' ])
                valueTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', valueTree, true, true)
                )

                const labelTree = objectValue([], [ 'Tree' ])
                labelTree.fields.push(
                    field('label', scalar(defineString())),
                    field('children', labelTree, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['TreePair', fragment([
                        field('valueTree', valueTree, false),
                        field('labelTree', labelTree, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())
                const labelAliasName = result.match(/type (TreeAlias_[a-f0-9]{4}) =/)?.[1]

                expect(labelAliasName).toBeDefined()
                expect(result).toContain([
                    '\ttype TreeAlias = {',
                    `\t\t__typename?: 'Tree';`,
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<TreeAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    `\ttype ${labelAliasName} = {`,
                    `\t\t__typename?: 'Tree';`,
                    '\t\tlabel: string | null;',
                    `\t\tchildren: Array<${labelAliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type TreePair = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\tvalueTree: TreeAlias;',
                    `\t\tlabelTree: ${labelAliasName};`,
                    '\t}',
                ].join('\n'))
                expect(result.match(/type TreeAlias/g)).toHaveLength(2)
            })

            test('includes output field order in alias shape hashes', () => {
                const valueFirstTree = objectValue([], [ 'Tree' ])
                valueFirstTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', valueFirstTree, true, true)
                )

                const childrenFirstTree = objectValue([], [ 'Tree' ])
                childrenFirstTree.fields.push(
                    field('children', childrenFirstTree, true, true),
                    field('value', scalar(defineString()))
                )

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(new Map([
                        ['TreeAlias', fragment([
                            field('id', scalar(defineString()), false),
                        ], 'Tree')],
                        ['TreePair', fragment([
                            field('valueFirst', valueFirstTree, false),
                            field('childrenFirst', childrenFirstTree, false),
                        ], 'Query')],
                    ])),
                    new Map()
                )
                const valueFirstAliasName = result.match(
                    /type (TreeAlias_[a-f0-9]{4,8}) = \{\n\t\t__typename\?: 'Tree';\n\t\tvalue: string \| null;\n\t\tchildren: Array<\1> \| null;\n\t\}/
                )?.[1]
                const childrenFirstAliasName = result.match(
                    /type (TreeAlias_[a-f0-9]{4,8}) = \{\n\t\t__typename\?: 'Tree';\n\t\tchildren: Array<\1> \| null;\n\t\tvalue: string \| null;\n\t\}/
                )?.[1]

                expect(valueFirstAliasName).toBeDefined()
                expect(childrenFirstAliasName).toBeDefined()
                expect(valueFirstAliasName).not.toBe(childrenFirstAliasName)
                expect(result).toContain([
                    '\texport type TreePair = {',
                    `\t\t__typename?: 'Query';`,
                    `\t\tvalueFirst: ${valueFirstAliasName};`,
                    `\t\tchildrenFirst: ${childrenFirstAliasName};`,
                    '\t}',
                ].join('\n'))
            })

            test('reuses aliases for matching union shapes regardless of variant and type name order', () => {
                const searchResult = unionValue([
                    {
                        typeName: 'User',
                        fields: [
                            field('node', objectValue([
                                field('id', scalar(defineString()), false),
                            ], [ 'User', 'Admin' ]), false),
                        ],
                    },
                    {
                        typeName: 'Group',
                        fields: [
                            field('node', objectValue([
                                field('id', scalar(defineString()), false),
                            ], [ 'User', 'Admin' ]), false),
                        ],
                    },
                ])
                const mirroredSearchResult = unionValue([
                    {
                        typeName: 'Group',
                        fields: [
                            field('node', objectValue([
                                field('id', scalar(defineString()), false),
                            ], [ 'Admin', 'User' ]), false),
                        ],
                    },
                    {
                        typeName: 'User',
                        fields: [
                            field('node', objectValue([
                                field('id', scalar(defineString()), false),
                            ], [ 'Admin', 'User' ]), false),
                        ],
                    },
                ])

                const definitions = declarationDefinitions(new Map([
                    ['SearchPair', fragment([
                        field('primarySearch', searchResult, false),
                        field('secondarySearch', mirroredSearchResult, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())

                expect(result).toContain([
                    '\ttype ObjectAlias = {',
                    `\t\t__typename?: 'User' | 'Admin';`,
                    '\t\tid: string;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain('\t\tprimarySearch: {')
                expect(result).toContain('\t\tsecondarySearch: {')
                expect(result.match(/\tnode: ObjectAlias;/g)).toHaveLength(2)
                expect(result.match(/type ObjectAlias =/g)).toHaveLength(1)
            })

            test('avoids collisions between output aliases and operation payload exports', () => {
                const payloadShape = objectValue([
                    field('value', scalar(defineString())),
                ], [ 'Payload' ])

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map(),
                        new Map([
                            ['GetUser', operation(
                                OperationTypeNode.QUERY,
                                [
                                    field('payload', payloadShape, false),
                                    field('legacyPayload', objectValue([
                                        field('value', scalar(defineString())),
                                    ], [ 'Payload' ]), false),
                                ]
                            )],
                        ])
                    ),
                    new Map()
                )

                expect(result).toContain([
                    '\ttype PayloadAlias = {',
                    `\t\t__typename?: 'Payload';`,
                    '\t\tvalue: string | null;',
                    '\t}',
                ].join('\n'))

                expect(result).toContain([
                    '\texport type GetUserQueryPayload = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\tpayload: PayloadAlias;',
                    '\t\tlegacyPayload: PayloadAlias;',
                    '\t}',
                ].join('\n'))

                expect(result.match(/export type GetUserQueryPayload =/g)).toHaveLength(1)
            })

            test('uses a bounded shape hash when an output alias base name is occupied', () => {
                const recursiveTree = objectValue([], [ 'Tree' ])
                recursiveTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveTree, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['TreeAlias', fragment([
                        field('id', scalar(defineString()), false),
                    ], 'Tree')],
                    ['TreeFragment', fragment([
                        field('node', recursiveTree, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())
                const aliasName = result.match(/type (TreeAlias_[a-f0-9]{4}) =/)?.[1]

                expect(aliasName).toBeDefined()

                expect(result).toContain([
                    `\ttype ${aliasName} = {`,
                    `\t\t__typename?: 'Tree';`,
                    '\t\tvalue: string | null;',
                    `\t\tchildren: Array<${aliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type TreeFragment = {',
                    `\t\t__typename?: 'Query';`,
                    `\t\tnode: ${aliasName};`,
                    '\t}',
                ].join('\n'))
            })

            test('uses ObjectAlias with a hash when an anonymous output alias base name is occupied', () => {
                const recursiveObject = objectValue([])
                recursiveObject.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveObject, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['ObjectAlias', fragment([
                        field('id', scalar(defineString()), false),
                    ], 'Object')],
                    ['ObjectFragment', fragment([
                        field('node', recursiveObject, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())
                const aliasName = result.match(/type (ObjectAlias_[a-f0-9]{4}) =/)?.[1]

                expect(aliasName).toBeDefined()
                expect(result).toContain([
                    `\ttype ${aliasName} = {`,
                    '\t\tvalue: string | null;',
                    `\t\tchildren: Array<${aliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type ObjectFragment = {',
                    `\t\t__typename?: 'Query';`,
                    `\t\tnode: ${aliasName};`,
                    '\t}',
                ].join('\n'))
            })

            test('uses ObjectAlias for output aliases with multiple concrete type names', () => {
                const recursiveObject = objectValue([], [ 'User', 'Admin' ])
                recursiveObject.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveObject, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['ObjectFragment', fragment([
                        field('node', recursiveObject, false),
                    ], 'Query')],
                ]))

                const result = renderDeclaration('./documents', definitions, new Map())

                expect(result).toContain([
                    '\ttype ObjectAlias = {',
                    `\t\t__typename?: 'User' | 'Admin';`,
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<ObjectAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type ObjectFragment = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\tnode: ObjectAlias;',
                    '\t}',
                ].join('\n'))
            })

            test('uses a hash when an output alias base name is occupied by an imported type', () => {
                const recursiveTree = objectValue([], [ 'Tree' ])
                recursiveTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveTree, true, true)
                )

                const definitions = declarationDefinitions(new Map([
                    ['TreeFragment', fragment([
                        field('node', recursiveTree, false),
                    ], 'Query')],
                ]))
                const result = renderDeclaration(
                    './documents',
                    definitions,
                    new Map([['TreeAlias', './tree-types']])
                )
                const aliasName = result.match(/type (TreeAlias_[a-f0-9]{4}) =/)?.[1]

                expect(aliasName).toBeDefined()
                expect(result).toContain(`\timport type { TreeAlias } from './tree-types'`)
                expect(result).toContain([
                    `\ttype ${aliasName} = {`,
                    `\t\t__typename?: 'Tree';`,
                    '\t\tvalue: string | null;',
                    `\t\tchildren: Array<${aliasName}> | null;`,
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type TreeFragment = {',
                    `\t\t__typename?: 'Query';`,
                    `\t\tnode: ${aliasName};`,
                    '\t}',
                ].join('\n'))
            })

            test('keeps alias names independent from operation payload and variables export names', () => {
                const recursiveTree = objectValue([], [ 'Tree' ])
                recursiveTree.fields.push(
                    field('value', scalar(defineString())),
                    field('children', recursiveTree, true, true)
                )

                const result = renderDeclaration(
                    './documents',
                    declarationDefinitions(
                        new Map(),
                        new Map([
                            ['Tree', operation(
                                OperationTypeNode.QUERY,
                                [ field('node', recursiveTree, false) ],
                                [],
                                'Query'
                            )],
                        ])
                    ),
                    new Map()
                )

                expect(result).toContain([
                    '\ttype TreeAlias = {',
                    `\t\t__typename?: 'Tree';`,
                    '\t\tvalue: string | null;',
                    '\t\tchildren: Array<TreeAlias> | null;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain([
                    '\texport type TreeQueryPayload = {',
                    `\t\t__typename?: 'Query';`,
                    '\t\tnode: TreeAlias;',
                    '\t}',
                ].join('\n'))
                expect(result).toContain(`\texport type TreeQueryVariables = { [key: string]: never }`)
            })

            test('expands output alias hash length and falls back to indexed full-hash names', () => {
                const extractRecursiveTreeAlias = (result: string): string | undefined =>
                    result.match(
                        /\ttype (TreeAlias_[a-f0-9]{4,8}(?:\d+)?) = \{\n\t\t__typename\?: 'Tree';\n\t\tvalue: string \| null;\n\t\tchildren: Array<\1> \| null;\n\t\}/
                    )?.[1]
                const expectRecursiveTreeAlias = (result: string, aliasName: string | undefined) => {
                    expect(result).toContain([
                        `\ttype ${aliasName} = {`,
                        `\t\t__typename?: 'Tree';`,
                        '\t\tvalue: string | null;',
                        `\t\tchildren: Array<${aliasName}> | null;`,
                        '\t}',
                    ].join('\n'))
                }

                const renderWithOccupiedAliases = (occupiedAliasNames: string[]): string => {
                    const recursiveTree = objectValue([], [ 'Tree' ])
                    recursiveTree.fields.push(
                        field('value', scalar(defineString())),
                        field('children', recursiveTree, true, true)
                    )

                    return renderDeclaration(
                        './documents',
                        declarationDefinitions(new Map([
                            ...occupiedAliasNames.map(name => [name, fragment([
                                field('id', scalar(defineString()), false),
                            ], 'Tree')] as const),
                            ['TreeFragment', fragment([
                                field('node', recursiveTree, false),
                            ], 'Query')],
                        ])),
                        new Map()
                    )
                }

                const occupiedAliasNames = ['TreeAlias']
                const allocatedAliasNames = [4, 5, 6, 7, 8].map(hashLength => {
                    const result = renderWithOccupiedAliases(occupiedAliasNames)
                    const aliasName = extractRecursiveTreeAlias(result)

                    expect(aliasName).toMatch(new RegExp(`^TreeAlias_[a-f0-9]{${hashLength}}$`))
                    expectRecursiveTreeAlias(result, aliasName)

                    occupiedAliasNames.push(aliasName as string)
                    return aliasName
                })

                const fullHashAliasName = allocatedAliasNames[allocatedAliasNames.length - 1]
                const firstIndexedResult = renderWithOccupiedAliases(occupiedAliasNames)
                const firstIndexedAliasName = extractRecursiveTreeAlias(firstIndexedResult)

                expect(firstIndexedAliasName).toBe(`${fullHashAliasName}2`)
                expectRecursiveTreeAlias(firstIndexedResult, firstIndexedAliasName)

                occupiedAliasNames.push(firstIndexedAliasName as string)

                const secondIndexedResult = renderWithOccupiedAliases(occupiedAliasNames)
                const secondIndexedAliasName = extractRecursiveTreeAlias(secondIndexedResult)

                expect(secondIndexedAliasName).toBe(`${fullHashAliasName}3`)
                expectRecursiveTreeAlias(secondIndexedResult, secondIndexedAliasName)
            })
        })

        test('renders lists of object fields', () => {
            const definitions = declarationDefinitions(new Map([
                ['UserFriends', fragment([
                    field('friends', objectValue([
                        field('id', scalar(defineString()), false),
                        field('name', scalar(defineString())),
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
                            field('id', scalar(defineString()), false),
                            field('labels', scalar(defineString()), true, true),
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
                                field('email', scalar(defineString()), false),
                                field('status', enumValue('UserStatus')),
                            ],
                        },
                        {
                            typeName: 'Guest',
                            fields: [
                                field('nickname', scalar(defineString())),
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

        test('renders conditional fragment spreads inside collapsed union fields as Partial intersections', () => {
            const definitions = declarationDefinitions(new Map([
                ['SearchResult', fragment([
                    field('search', unionValue([
                        {
                            typeName: 'User',
                            fields: [{
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'NodeFields',
                                onType: 'Node',
                                conditional: true,
                                directiveNames: [ 'include' ],
                            }],
                        },
                        {
                            typeName: 'Group',
                            fields: [{
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'NodeFields',
                                onType: 'Node',
                                conditional: true,
                                directiveNames: [ 'include' ],
                            }],
                        },
                    ]), false),
                ], 'Query')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type SearchResult = {',
                `\t\t__typename?: 'Query';`,
                '\t\tsearch: {',
                `\t\t\t__typename: 'User' | 'Group';`,
                '\t\t} & Partial<NodeFields>;',
            ].join('\n'))
        })

        test('renders fragment spreads inside collapsed union fields as required intersections', () => {
            const definitions = declarationDefinitions(new Map([
                ['SearchResult', fragment([
                    field('search', unionValue([
                        {
                            typeName: 'User',
                            fields: [{
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'NodeFields',
                                onType: 'Node',
                                conditional: false,
                            }],
                        },
                        {
                            typeName: 'Group',
                            fields: [{
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'NodeFields',
                                onType: 'Node',
                                conditional: false,
                            }],
                        },
                    ]), false),
                ], 'Query')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type SearchResult = {',
                `\t\t__typename?: 'Query';`,
                '\t\tsearch: {',
                `\t\t\t__typename: 'User' | 'Group';`,
                '\t\t} & NodeFields;',
            ].join('\n'))
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
                        field('id', scalar(defineString()), false),
                        field('username', scalar(defineString()), false),
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
                                    field('id', scalar(defineString()), false),
                                    field('permissions', scalar(arrayOf(defineString())), false),
                                ],
                            },
                            {
                                typeName: 'AdminPayload',
                                fields: [
                                    field('id', scalar(defineString()), false),
                                    field('role', scalar(defineString()), false),
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
                    field('id', scalar(defineString()), false),
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
                    argumentsSignature: '',
                    conditional: false,
                    typeRef: {
                        kind: TYPE_REF_KIND.NON_NULL,
                        ofType: {
                            kind: TYPE_REF_KIND.NAMED,
                            name: 'String',
                        },
                    },
                    value: typenameValue('User'),
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
                        argumentsSignature: '',
                        conditional: false,
                        typeRef: {
                            kind: TYPE_REF_KIND.NON_NULL,
                            ofType: {
                                kind: TYPE_REF_KIND.NAMED,
                                name: 'String',
                            },
                        },
                        value: typenameValue('Profile'),
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
                        conditional: false,
                        selections: [
                            field('__typename', typenameValue('User'), false),
                        ],
                    },
                    field('id', scalar(defineString()), false),
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
                                    field('id', scalar(defineString()), false),
                                ],
                            },
                            {
                                typeName: 'AdminPayload',
                                fields: [
                                    field('__typename', typenameValue('AdminPayload'), false),
                                    field('id', scalar(defineString()), false),
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
                            field('id', scalar(defineString()), false),
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
                                conditional: false,
                            },
                            field('groups', scalar(defineNamed('GroupDetails')), false, true),
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
                            field('id', scalar(defineString()), false),
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
                                directiveNames: [ 'include' ],
                            },
                            field('groups', scalar(defineNamed('GroupDetails')), false, true),
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
                            field('id', scalar(defineString()), false),
                        ],
                    },
                }],
                ['UserPresence', {
                    onType: 'User',
                    onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('isOnline', scalar(defineBoolean()), false),
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
                                conditional: false,
                            },
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserPresence',
                                onType: 'User',
                                onTypeNames: [ 'UserPayload', 'AdminPayload' ],
                                conditional: false,
                            },
                            field('groups', scalar(defineNamed('GroupDetails')), false, true),
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
                            field('id', scalar(defineString()), false),
                        ],
                    },
                }],
                ['UserPresence', {
                    onType: 'User',
                    onTypeNames: [ 'ModeratorPayload', 'AdminPayload' ],
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        fields: [
                            field('isOnline', scalar(defineBoolean()), false),
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
                                conditional: false,
                            },
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'UserPresence',
                                onType: 'User',
                                onTypeNames: [ 'ModeratorPayload', 'AdminPayload' ],
                                conditional: false,
                            },
                            field('groups', scalar(defineNamed('GroupDetails')), false, true),
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
                    field('id', scalar(defineString()), false),
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'Admin',
                        conditional: false,
                        selections: [
                            field('permissions', scalar(defineString()), false, true),
                            field('isOwner', scalar(defineBoolean()), false),
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
                    field('id', scalar(defineString()), false),
                    {
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'SharedFields',
                        onType: 'User',
                        conditional: false,
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
                    field('id', scalar(defineString()), false),
                    {
                        ...field('nickname', scalar(defineString())),
                        conditional: true,
                        directiveNames: [ 'include' ],
                    },
                    {
                        ...field('email', scalar(defineString()), false),
                        conditional: true,
                        directiveNames: [ 'skip' ],
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
                    field('id', scalar(defineString()), false),
                    field('email', scalar(defineString())),
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
                    field('id', scalar(defineString()), false),
                    {
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'SharedFields',
                        onType: 'User',
                        conditional: true,
                        directiveNames: [ 'include' ],
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
                    field('id', scalar(defineString()), false),
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'Admin',
                        conditional: true,
                        directiveNames: [ 'skip' ],
                        selections: [
                            field('permissions', scalar(defineString()), false, true),
                            field('isOwner', scalar(defineBoolean()), false),
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

        test('keeps nested object fields optional when only one repeated parent selection is conditional', () => {
            const definitions = declarationDefinitions(new Map([
                ['ConditionalNestedUser', fragment([
                    field('user', objectValue([
                        field('name', scalar(defineString()), false),
                    ], [ 'User' ]), false),
                    {
                        ...field('user', objectValue([
                            field('id', scalar(defineString()), false),
                        ], [ 'User' ]), false),
                        conditional: true,
                        directiveNames: [ 'include' ],
                    },
                ], 'Query')],
            ]))

            expect(renderDeclaration('./documents', definitions, new Map())).toContain([
                '\texport type ConditionalNestedUser = {',
                `\t\t__typename?: 'Query';`,
                '\t\tuser: {',
                `\t\t\t__typename?: 'User';`,
                '\t\t\tname: string;',
                '\t\t\tid?: string;',
                '\t\t};',
            ].join('\n'))
        })

        test('renders nested fragment spreads inside object fields', () => {
            const definitions = declarationDefinitions(new Map([
                ['NestedSpreadContainer', fragment([
                    field('profile', objectValue([
                        field('id', scalar(defineString()), false),
                        {
                            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                            name: 'ProfileDetails',
                            onType: 'Profile',
                            conditional: false,
                        },
                        field('contacts', objectValue([
                            {
                                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                                name: 'ContactFields',
                                onType: 'Contact',
                                conditional: false,
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
                    field('id', scalar(defineString()), false),
                    field('status', enumValue('UserStatus')),
                    field('tags', scalar(defineString()), false, true),
                    field('profile', objectValue([
                        field('bio', scalar(defineString())),
                    ]), false),
                    {
                        kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                        typeCondition: 'Admin',
                        conditional: false,
                        selections: [
                            field('role', scalar(defineString()), false),
                        ],
                    },
                    {
                        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                        name: 'SharedFields',
                        onType: 'User',
                        conditional: false,
                    },
                    field('search', unionValue([
                        {
                            typeName: 'User',
                            fields: [field('email', scalar(defineString()), false)],
                        },
                        {
                            typeName: 'Guest',
                            fields: [field('nickname', scalar(defineString()))],
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

            const result = renderDeclaration(
                './documents',
                definitions,
                new Map()
            )

            expect(result).toContain('\t\tmystery: unknown | null;')
            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith('Unknown type')

            warn.mockRestore()
        })
    })
})
