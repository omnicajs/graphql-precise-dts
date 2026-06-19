import type { SchemaOutputModel } from '../../../src/models/generation'

import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    arrayOf,
    defineGeneric,
    defineLiteral,
    defineNamed,
    defineObject,
    defineObjectField,
    defineString,
    defineTuple,
    intersectionOf,
    makeNullable,
    unionOf,
} from '../../../src'
import { renderSchemaDeclaration } from '../../../src/render/schema'

const EXACT_TYPE_DECLARATION = 'export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }'
const MAYBE_PROMISE_TYPE_DECLARATION = 'export type MaybePromise<T> = T | Promise<T>'
const SCHEMA_HELPER_DECLARATIONS = [
    EXACT_TYPE_DECLARATION,
    MAYBE_PROMISE_TYPE_DECLARATION,
].join('\n')

const makeSchemaModel = (schema: Partial<SchemaOutputModel>): SchemaOutputModel => ({
    enumReferences: new Set(),
    scalars: new Map(),
    inputTypes: new Map(),
    interfaceTypes: new Map(),
    objectTypes: new Map(),
    unionTypes: new Map(),
    fieldArgTypes: [],
    ...schema,
})

describe('schema render', () => {
    test('normalizes schema declaration names', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            enumReferences: new Set([ 'user_status' ]),
            inputTypes: new Map([
                [ 'user_filter', defineObject({
                    user_status: defineObjectField(makeNullable(defineNamed('user_status')), true),
                }) ],
            ]),
            objectTypes: new Map([
                [ 'user_profile', {
                    interfaces: [],
                    fields: defineObject({
                        __typename: defineObjectField(defineLiteral('user_profile'), true),
                        user_id: defineObjectField(defineString()),
                        status: defineObjectField(defineNamed('user_status')),
                    }),
                } ],
            ]),
            fieldArgTypes: [
                {
                    parentTypeName: 'query_root',
                    fieldName: 'user_profile',
                    type: defineObject({
                        filter_by: defineObjectField(makeNullable(defineNamed('user_filter')), true),
                    }),
                },
            ],
        }))

        expect(result).toBe([
            `import type { UserStatus } from './enums'\n`,
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type UserFilter = {',
            '\tuser_status?: UserStatus | null;',
            '}',
            '',
            'export type UserProfile = {',
            `\t__typename?: 'user_profile';`,
            '\tuser_id: string;',
            '\tstatus: UserStatus;',
            '}',
            '',
            'export type QueryRootUserProfileArgs = {',
            '\tfilter_by?: UserFilter | null;',
            '}',
        ].join('\n'))
    })

    test('preserves schema field keys', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            inputTypes: new Map([
                [ 'user_filter', defineObject({
                    filter_by: defineObjectField(makeNullable(defineString()), true),
                }) ],
            ]),
            objectTypes: new Map([
                [ 'user_profile', {
                    interfaces: [],
                    fields: defineObject({
                        __typename: defineObjectField(defineLiteral('user_profile'), true),
                        user_id: defineObjectField(defineString()),
                        display_name: defineObjectField(makeNullable(defineString())),
                    }),
                } ],
            ]),
            fieldArgTypes: [
                {
                    parentTypeName: 'query_root',
                    fieldName: 'user_profile',
                    type: defineObject({
                        filter_by: defineObjectField(makeNullable(defineNamed('user_filter')), true),
                    }),
                },
            ],
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type UserFilter = {',
            '\tfilter_by?: string | null;',
            '}',
            '',
            'export type UserProfile = {',
            `\t__typename?: 'user_profile';`,
            '\tuser_id: string;',
            '\tdisplay_name: string | null;',
            '}',
            '',
            'export type QueryRootUserProfileArgs = {',
            '\tfilter_by?: UserFilter | null;',
            '}',
        ].join('\n'))
    })

    test('fails when schema declarations collide after naming normalization', () => {
        expect(() => renderSchemaDeclaration(makeSchemaModel({
            inputTypes: new Map([
                [ 'UserStatus', defineString() ],
                [ 'user_status', defineString() ],
            ]),
        }))).toThrow(
            'Name collision detected in generated schema declarations: "UserStatus" and "user_status" both render as "UserStatus". Adjust namingConvention so generated schema declaration names are unique.'
        )
    })

    test('renders sorted scalar declarations', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            scalars: new Map([
                [ 'DateTime', { input: 'string', output: 'Date' } ],
                [ 'String', { input: 'string', output: 'string' } ],
                [ 'ID', { input: 'string', output: 'string' } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type Scalars = {',
            '\tID: { input: string; output: string; };',
            '\tString: { input: string; output: string; };',
            '\tDateTime: { input: string; output: Date; };',
            '}',
        ].join('\n'))
    })

    test('renders scalar descriptions as JSDoc', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            scalars: new Map([
                [ 'DateTime', {
                    input: 'string',
                    output: 'Date',
                    description: 'ISO date-time string.',
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type Scalars = {',
            '\t/** ISO date-time string. */',
            '\tDateTime: { input: string; output: Date; };',
            '}',
        ].join('\n'))
    })

    test('renders scalar specifiedBy URLs as JSDoc see tags', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            scalars: new Map([
                [ 'DateTime', {
                    input: 'string',
                    output: 'Date',
                    description: 'ISO date-time string.',
                    specifiedByUrl: 'https://scalars.graphql.org/andimarek/date-time.html',
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type Scalars = {',
            '\t/**',
            '\t * ISO date-time string.',
            '\t * @see https://scalars.graphql.org/andimarek/date-time.html',
            '\t */',
            '\tDateTime: { input: string; output: Date; };',
            '}',
        ].join('\n'))
    })

    test('renders helper declarations for an empty schema model', () => {
        expect(renderSchemaDeclaration(makeSchemaModel({
            scalars: new Map(),
        }))).toBe(SCHEMA_HELPER_DECLARATIONS)
    })

    test('sorts primitive scalars ahead of custom scalars in canonical order', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            scalars: new Map([
                [ 'DateTime', { input: 'string', output: 'Date' } ],
                [ 'Float', { input: 'number', output: 'number' } ],
                [ 'ID', { input: 'string', output: 'string' } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type Scalars = {',
            '\tID: { input: string; output: string; };',
            '\tFloat: { input: number; output: number; };',
            '\tDateTime: { input: string; output: Date; };',
            '}',
        ].join('\n'))
    })

    test('keeps primitive scalars before later custom scalars', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            scalars: new Map([
                [ 'ID', { input: 'string', output: 'string' } ],
                [ 'DateTime', { input: 'string', output: 'Date' } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            'export type Scalars = {',
            '\tID: { input: string; output: string; };',
            '\tDateTime: { input: string; output: Date; };',
            '}',
        ].join('\n'))
    })

    test('renders multiline enum imports', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            enumReferences: new Set([ 'UserStatus', 'GroupStatus' ]),
        }))

        expect(result).toBe([
            `import type {`,
            `\tGroupStatus,`,
            `\tUserStatus,`,
            `} from './enums'\n`,
            SCHEMA_HELPER_DECLARATIONS,
        ].join('\n'))
    })

    test('renders input type declarations', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            inputTypes: new Map([
                [ 'UserFilter', defineObject({
                    groupStatus: defineObjectField(makeNullable(defineNamed('GroupStatus')), true),
                    status: defineObjectField(makeNullable(defineNamed('UserStatus')), true),
                }) ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type UserFilter = {`,
            `\tgroupStatus?: GroupStatus | null;`,
            `\tstatus?: UserStatus | null;`,
            `}`,
        ].join('\n'))
    })

    test('renders interface type declarations', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            interfaceTypes: new Map([
                [ 'Node', defineObject({
                    id: defineObjectField(defineString()),
                }) ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type Node = {`,
            `\tid: string;`,
            `}`,
        ].join('\n'))
    })

    test('renders object type declarations with interfaces', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            objectTypes: new Map([
                [ 'User', {
                    interfaces: [ 'Node' ],
                    fields: defineObject({
                        __typename: defineObjectField(defineLiteral('User'), true),
                        groupStatus: defineObjectField(defineNamed('GroupStatus')),
                        id: defineObjectField(defineString()),
                        status: defineObjectField(defineNamed('UserStatus')),
                    }),
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type User = Node & {`,
            `\t__typename?: 'User';`,
            `\tgroupStatus: GroupStatus;`,
            `\tid: string;`,
            `\tstatus: UserStatus;`,
            `}`,
        ].join('\n'))
    })

    test('renders object type declarations without interfaces', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            objectTypes: new Map([
                [ 'User', {
                    interfaces: [],
                    fields: defineObject({
                        __typename: defineObjectField(defineLiteral('User'), true),
                        id: defineObjectField(defineString()),
                    }),
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type User = {`,
            `\t__typename?: 'User';`,
            `\tid: string;`,
            `}`,
        ].join('\n'))
    })

    test('renders object field declarations when descriptions are absent', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            objectTypes: new Map([
                [ 'User', {
                    interfaces: [ 'Node' ],
                    fields: defineObject({
                        id: defineObjectField(defineString()),
                    }),
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type User = Node & {`,
            `\tid: string;`,
            `}`,
        ].join('\n'))
        expect(result).not.toContain('/**')
    })

    test('renders object type descriptions as JSDoc', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            objectTypes: new Map([
                [ 'User', {
                    description: 'Application user.',
                    interfaces: [],
                    fields: defineObject({
                        id: defineObjectField(defineString()),
                    }),
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `/** Application user. */`,
            `export type User = {`,
            `\tid: string;`,
            `}`,
        ].join('\n'))
    })

    test('renders union type declarations', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            unionTypes: new Map([
                [ 'SearchResult', unionOf(defineNamed('User'), defineNamed('Group')) ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type SearchResult = User | Group`,
        ].join('\n'))
    })

    test('renders field args declarations', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            fieldArgTypes: [
                {
                    parentTypeName: 'Query',
                    fieldName: 'user',
                    type: defineObject({
                        id: defineObjectField(defineString()),
                        tags: defineObjectField(makeNullable(arrayOf(defineString())), true),
                    }),
                },
            ],
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type QueryUserArgs = {`,
            `\tid: string;`,
            `\ttags?: Array<string> | null;`,
            `}`,
        ].join('\n'))
    })

    test('normalizes schema references in complex field args declarations', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            inputTypes: new Map([
                [ 'user_filter', defineObject({ id: defineObjectField(defineString()) }) ],
                [ 'page_info', defineObject({ cursor: defineObjectField(defineString()) }) ],
            ]),
            fieldArgTypes: [
                {
                    parentTypeName: 'query_root',
                    fieldName: 'z_search',
                    type: defineObject({
                        array_ref: defineObjectField(arrayOf(defineNamed('user_filter'))),
                        generic_ref: defineObjectField(defineGeneric('Promise', defineNamed('user_filter'))),
                        intersection_ref: defineObjectField(intersectionOf(defineNamed('user_filter'), defineNamed('page_info'))),
                        tuple_ref: defineObjectField(defineTuple(defineNamed('user_filter'), defineNamed('page_info'))),
                        union_ref: defineObjectField(unionOf(defineNamed('user_filter'), defineNamed('page_info'))),
                    }),
                },
                {
                    parentTypeName: 'query_root',
                    fieldName: 'a_search',
                    type: defineObject({
                        filter: defineObjectField(defineNamed('user_filter')),
                    }),
                },
            ],
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type PageInfo = {`,
            `\tcursor: string;`,
            `}\n`,
            `export type UserFilter = {`,
            `\tid: string;`,
            `}\n`,
            `export type QueryRootASearchArgs = {`,
            `\tfilter: UserFilter;`,
            `}\n`,
            `export type QueryRootZSearchArgs = {`,
            `\tarray_ref: Array<UserFilter>;`,
            `\tgeneric_ref: Promise<UserFilter>;`,
            `\tintersection_ref: UserFilter & PageInfo;`,
            `\ttuple_ref: [UserFilter, PageInfo];`,
            `\tunion_ref: UserFilter | PageInfo;`,
            `}`,
        ].join('\n'))
    })

    test('renders GraphQL descriptions and deprecations as JSDoc', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            inputTypes: new Map([
                [ 'TariffFilter', {
                    ...defineObject({
                        tariffType: defineObjectField(
                            defineNamed('TariffType'),
                            false,
                            {
                                description: 'Current tariff type.',
                                deprecationReason: 'Use `tariffType === TariffType.Basic` instead',
                                remarks: 'Scalar reference: `Scalars[\'String\'][\'input\']`.',
                            }
                        ),
                    }),
                    description: 'Filters tariff search.',
                } ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `/** Filters tariff search. */`,
            `export type TariffFilter = {`,
            `\t/**`,
            `\t * Current tariff type.`,
            `\t * @deprecated Use \`tariffType === TariffType.Basic\` instead`,
            `\t * @remarks Scalar reference: \`Scalars['String']['input']\`.`,
            `\t */`,
            `\ttariffType: TariffType;`,
            `}`,
        ].join('\n'))
    })

    test('renders schema declarations in stable section order', () => {
        const result = renderSchemaDeclaration(makeSchemaModel({
            enumReferences: new Set([ 'UserStatus' ]),
            scalars: new Map([
                [ 'ID', { input: 'string', output: 'string' } ],
            ]),
            inputTypes: new Map([
                [ 'UserFilter', defineObject({ status: defineObjectField(defineNamed('UserStatus')) }) ],
            ]),
            interfaceTypes: new Map([
                [ 'Node', defineObject({ id: defineObjectField(defineString()) }) ],
            ]),
            objectTypes: new Map([
                [ 'User', { interfaces: [ 'Node' ], fields: defineObject({ id: defineObjectField(defineString()) }) } ],
            ]),
            unionTypes: new Map([
                [ 'SearchResult', unionOf(defineNamed('User'), defineNamed('Group')) ],
            ]),
            fieldArgTypes: [
                {
                    parentTypeName: 'Query',
                    fieldName: 'user',
                    type: defineObject({ id: defineObjectField(defineString()) }),
                },
            ],
        }))

        expect(result).toBe([
            `import type { UserStatus } from './enums'\n`,
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type Scalars = {`,
            `\tID: { input: string; output: string; };`,
            `}\n`,
            `export type UserFilter = {`,
            `\tstatus: UserStatus;`,
            `}\n`,
            `export type Node = {`,
            `\tid: string;`,
            `}\n`,
            `export type User = Node & {`,
            `\tid: string;`,
            `}\n`,
            `export type SearchResult = User | Group\n`,
            `export type QueryUserArgs = {`,
            `\tid: string;`,
            `}`,
        ].join('\n'))
    })
})
