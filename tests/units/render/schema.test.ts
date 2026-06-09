import type { SchemaOutputModel } from '../../../src/models/generation'

import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    arrayOf,
    defineLiteral,
    defineNamed,
    defineObject,
    defineObjectField,
    defineString,
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
    fieldArgs: new Map(),
    ...schema,
})

describe('schema render', () => {
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
            fieldArgs: new Map([
                [ 'QueryUserArgs', defineObject({
                    id: defineObjectField(defineString()),
                    tags: defineObjectField(makeNullable(arrayOf(defineString())), true),
                }) ],
            ]),
        }))

        expect(result).toBe([
            SCHEMA_HELPER_DECLARATIONS + '\n',
            `export type QueryUserArgs = {`,
            `\tid: string;`,
            `\ttags?: Array<string> | null;`,
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
            fieldArgs: new Map([
                [ 'QueryUserArgs', defineObject({ id: defineObjectField(defineString()) }) ],
            ]),
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
