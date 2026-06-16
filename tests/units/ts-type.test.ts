import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    arrayOf,
    defineBoolean,
    defineGeneric,
    defineLiteral,
    defineNamed,
    defineNull,
    defineNumber,
    defineObject,
    defineObjectField,
    defineString,
    defineTuple,
    defineUnknown,
    intersectionOf,
    isSameTsType,
    isTsKeywordTypeName,
    makeNullable,
    normalizeTsType,
    renderType,
    unionOf,
} from '../../src/ts-type'

import { TS_TYPE_KIND } from '../../src'

describe('ts type', () => {
    test('renders generic, intersection and tuple types', () => {
        expect(renderType(defineGeneric('Record', defineNamed('string'), defineNamed('User'))))
            .toBe('Record<string, User>')
        expect(renderType(intersectionOf(defineNamed('UserBase'), defineGeneric('Partial', defineNamed('UserMeta')))))
            .toBe('UserBase & Partial<UserMeta>')
        expect(renderType(defineTuple(defineNamed('string'), defineNull(), defineNamed('User'))))
            .toBe('[string, null, User]')
    })

    test('renders arrays, objects and literals', () => {
        expect(renderType(arrayOf(defineString()))).toBe('Array<string>')
        expect(renderType(defineObject({
            id: defineObjectField(defineString()),
            age: defineObjectField(defineNumber(), true),
            flags: defineObjectField(arrayOf(defineBoolean())),
        }))).toBe([
            '{',
            '\tid: string;',
            '\tage?: number;',
            '\tflags: Array<boolean>;',
            '}',
        ].join('\n'))
        expect(renderType(defineLiteral('user'))).toBe('\'user\'')
        expect(renderType(defineLiteral(7))).toBe('7')
        expect(renderType(defineLiteral(false))).toBe('false')
    })

    test('renders parentheses when union and intersection precedence would change meaning', () => {
        expect(renderType(unionOf(
            defineNamed('User'),
            intersectionOf(defineNamed('Node'), defineNamed('AuditFields'))
        ))).toBe('User | Node & AuditFields')

        expect(renderType(intersectionOf(
            defineNamed('User'),
            unionOf(defineNamed('Node'), defineNamed('AuditFields'))
        ))).toBe('User & (Node | AuditFields)')
    })

    test('creates primitive and nullable aliases consistently', () => {
        expect(defineString()).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'string' })
        expect(defineNumber()).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'number' })
        expect(defineBoolean()).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'boolean' })
        expect(defineUnknown()).toEqual({ kind: TS_TYPE_KIND.UNKNOWN })
        expect(defineNamed('unknown')).toEqual({ kind: TS_TYPE_KIND.UNKNOWN })
        expect(renderType(defineUnknown())).toBe('unknown')
        expect(makeNullable(defineString())).toEqual({
            kind: TS_TYPE_KIND.UNION,
            types: [
                { kind: TS_TYPE_KIND.NAMED, name: 'string' },
                { kind: TS_TYPE_KIND.NULL },
            ],
        })
    })

    test('detects TypeScript keyword type names', () => {
        expect(isTsKeywordTypeName('string')).toBe(true)
        expect(isTsKeywordTypeName('unknown')).toBe(true)
        expect(isTsKeywordTypeName('never')).toBe(true)
        expect(isTsKeywordTypeName('Date')).toBe(false)
        expect(isTsKeywordTypeName('Record')).toBe(false)
    })

    test('normalizes arrays recursively', () => {
        expect(normalizeTsType(arrayOf(unionOf(defineString(), defineNull(), defineNull())))).toEqual({
            kind: TS_TYPE_KIND.ARRAY,
            ofType: {
                kind: TS_TYPE_KIND.UNION,
                types: [
                    { kind: TS_TYPE_KIND.NAMED, name: 'string' },
                    { kind: TS_TYPE_KIND.NULL },
                ],
            },
        })
    })

    test('normalizes objects recursively', () => {
        expect(normalizeTsType(defineObject({
            profile: defineObjectField(
                intersectionOf(
                    defineNamed('ProfileBase'),
                    intersectionOf(defineNamed('ProfileMeta'), defineNamed('ProfileBase'))
                )
            ),
            roles: defineObjectField(arrayOf(unionOf(defineNamed('Role'), defineNull(), defineNull())), true),
        }))).toEqual({
            kind: TS_TYPE_KIND.OBJECT,
            fields: [
                {
                    name: 'profile',
                    optional: false,
                    type: {
                        kind: TS_TYPE_KIND.INTERSECTION,
                        types: [
                            { kind: TS_TYPE_KIND.NAMED, name: 'ProfileBase' },
                            { kind: TS_TYPE_KIND.NAMED, name: 'ProfileMeta' },
                        ],
                    },
                },
                {
                    name: 'roles',
                    optional: true,
                    type: {
                        kind: TS_TYPE_KIND.ARRAY,
                        ofType: {
                            kind: TS_TYPE_KIND.UNION,
                            types: [
                                { kind: TS_TYPE_KIND.NAMED, name: 'Role' },
                                { kind: TS_TYPE_KIND.NULL },
                            ],
                        },
                    },
                },
            ],
        })
    })

    test('normalizes tuples recursively', () => {
        expect(normalizeTsType(defineTuple(
            unionOf(defineString(), defineNull(), defineNull()),
            intersectionOf(defineNamed('Node'), defineNamed('Node')),
            defineObject({
                roles: defineObjectField(arrayOf(unionOf(defineNamed('Role'), defineNull(), defineNull()))),
            })
        ))).toEqual({
            kind: TS_TYPE_KIND.TUPLE,
            items: [
                {
                    kind: TS_TYPE_KIND.UNION,
                    types: [
                        { kind: TS_TYPE_KIND.NAMED, name: 'string' },
                        { kind: TS_TYPE_KIND.NULL },
                    ],
                },
                {
                    kind: TS_TYPE_KIND.NAMED,
                    name: 'Node',
                },
                {
                    kind: TS_TYPE_KIND.OBJECT,
                    fields: [{
                        name: 'roles',
                        optional: false,
                        type: {
                            kind: TS_TYPE_KIND.ARRAY,
                            ofType: {
                                kind: TS_TYPE_KIND.UNION,
                                types: [
                                    { kind: TS_TYPE_KIND.NAMED, name: 'Role' },
                                    { kind: TS_TYPE_KIND.NULL },
                                ],
                            },
                        },
                    }],
                },
            ],
        })
    })

    test('normalizes nested intersection and union structures recursively', () => {
        const type = normalizeTsType(intersectionOf(
            defineNamed('A'),
            intersectionOf(defineNamed('B'), defineNamed('A')),
            defineGeneric('Readonly', unionOf(defineNamed('C'), defineNull(), defineNull()))
        ))

        expect(type).toEqual({
            kind: TS_TYPE_KIND.INTERSECTION,
            types: [
                { kind: TS_TYPE_KIND.NAMED, name: 'A' },
                { kind: TS_TYPE_KIND.NAMED, name: 'B' },
                {
                    kind: TS_TYPE_KIND.GENERIC,
                    name: 'Readonly',
                    args: [{
                        kind: TS_TYPE_KIND.UNION,
                        types: [
                            { kind: TS_TYPE_KIND.NAMED, name: 'C' },
                            { kind: TS_TYPE_KIND.NULL },
                        ],
                    }],
                },
            ],
        })
    })

    test('collapses raw union and intersection types to one normalized type', () => {
        expect(normalizeTsType({
            kind: TS_TYPE_KIND.UNION,
            types: [ defineString(), defineString() ],
        })).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'string' })

        expect(normalizeTsType({
            kind: TS_TYPE_KIND.INTERSECTION,
            types: [ defineNamed('Node'), defineNamed('Node') ],
        })).toEqual({
            kind: TS_TYPE_KIND.NAMED,
            name: 'Node',
        })
    })

    test('collapses unions and intersections with one unique type and compares canonical shapes', () => {
        expect(unionOf(defineString(), defineString())).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'string' })
        expect(intersectionOf(defineNamed('Node'), defineNamed('Node'))).toEqual({
            kind: TS_TYPE_KIND.NAMED,
            name: 'Node',
        })

        expect(isSameTsType(
            unionOf(defineString(), defineNull(), defineNull()),
            unionOf(defineString(), defineNull())
        )).toBe(true)

        expect(isSameTsType(
            unionOf(defineString(), defineNull()),
            unionOf(defineNull(), defineString())
        )).toBe(true)

        expect(isSameTsType(
            intersectionOf(defineNamed('User'), unionOf(defineNamed('Node'), defineNamed('AuditFields'))),
            intersectionOf(unionOf(defineNamed('AuditFields'), defineNamed('Node')), defineNamed('User'))
        )).toBe(true)

        expect(isSameTsType(
            intersectionOf(defineNamed('User'), unionOf(defineNamed('Node'), defineNamed('AuditFields'))),
            unionOf(intersectionOf(defineNamed('User'), defineNamed('Node')), defineNamed('AuditFields'))
        )).toBe(false)

        expect(isSameTsType(
            defineObject({ id: defineObjectField(defineString()) }),
            defineObject({ id: defineObjectField(defineNumber()) })
        )).toBe(false)
    })
})
