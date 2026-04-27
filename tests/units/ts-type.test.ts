import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    arrayOf,
    booleanType,
    canonicalizeTsType,
    genericType,
    intersectionOf,
    isSameTsType,
    literalType,
    makeNullableType,
    namedType,
    nullType,
    numberType,
    objectType,
    renderType,
    stringType,
    tupleType,
    unionOf,
    unknownType,
} from '../../src/ts-type'

import { TS_TYPE_KIND } from '../../src'

describe('ts type', () => {
    test('renders generic, intersection and tuple types', () => {
        expect(renderType(genericType('Record', namedType('string'), namedType('User'))))
            .toBe('Record<string, User>')
        expect(renderType(intersectionOf(namedType('UserBase'), genericType('Partial', namedType('UserMeta')))))
            .toBe('UserBase & Partial<UserMeta>')
        expect(renderType(tupleType(namedType('string'), nullType(), namedType('User'))))
            .toBe('[string, null, User]')
    })

    test('renders arrays, objects and literals', () => {
        expect(renderType(arrayOf(stringType()))).toBe('Array<string>')
        expect(renderType(objectType([
            { name: 'id', type: stringType() },
            { name: 'age', type: numberType(), optional: true },
            { name: 'flags', type: arrayOf(booleanType()) },
        ]))).toBe([
            '{',
            '\tid: string;',
            '\tage?: number;',
            '\tflags: Array<boolean>;',
            '}',
        ].join('\n'))
        expect(renderType(literalType('user'))).toBe('\'user\'')
        expect(renderType(literalType(7))).toBe('7')
        expect(renderType(literalType(false))).toBe('false')
    })

    test('renders parentheses when union and intersection precedence would change meaning', () => {
        expect(renderType(unionOf(
            namedType('User'),
            intersectionOf(namedType('Node'), namedType('AuditFields'))
        ))).toBe('User | Node & AuditFields')

        expect(renderType(intersectionOf(
            namedType('User'),
            unionOf(namedType('Node'), namedType('AuditFields'))
        ))).toBe('User & (Node | AuditFields)')
    })

    test('creates primitive and nullable aliases consistently', () => {
        expect(stringType()).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'string' })
        expect(numberType()).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'number' })
        expect(booleanType()).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'boolean' })
        expect(unknownType()).toEqual({ kind: TS_TYPE_KIND.UNKNOWN })
        expect(namedType('unknown')).toEqual({ kind: TS_TYPE_KIND.UNKNOWN })
        expect(renderType(unknownType())).toBe('unknown')
        expect(makeNullableType(stringType())).toEqual({
            kind: TS_TYPE_KIND.UNION,
            types: [
                { kind: TS_TYPE_KIND.NAMED, name: 'string' },
                { kind: TS_TYPE_KIND.NULL },
            ],
        })
    })

    test('canonicalizes arrays recursively', () => {
        expect(canonicalizeTsType(arrayOf(unionOf(stringType(), nullType(), nullType())))).toEqual({
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

    test('canonicalizes objects recursively', () => {
        expect(canonicalizeTsType(objectType([
            {
                name: 'profile',
                type: intersectionOf(
                    namedType('ProfileBase'),
                    intersectionOf(namedType('ProfileMeta'), namedType('ProfileBase'))
                ),
            },
            {
                name: 'roles',
                optional: true,
                type: arrayOf(unionOf(namedType('Role'), nullType(), nullType())),
            },
        ]))).toEqual({
            kind: TS_TYPE_KIND.OBJECT,
            fields: [
                {
                    name: 'profile',
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

    test('canonicalizes tuples recursively', () => {
        expect(canonicalizeTsType(tupleType(
            unionOf(stringType(), nullType(), nullType()),
            intersectionOf(namedType('Node'), namedType('Node')),
            objectType([{
                name: 'roles',
                type: arrayOf(unionOf(namedType('Role'), nullType(), nullType())),
            }])
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

    test('canonicalizes nested intersection and union structures recursively', () => {
        const type = canonicalizeTsType(intersectionOf(
            namedType('A'),
            intersectionOf(namedType('B'), namedType('A')),
            genericType('Readonly', unionOf(namedType('C'), nullType(), nullType()))
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

    test('collapses unions and intersections with one unique type and compares canonical shapes', () => {
        expect(unionOf(stringType(), stringType())).toEqual({ kind: TS_TYPE_KIND.NAMED, name: 'string' })
        expect(intersectionOf(namedType('Node'), namedType('Node'))).toEqual({
            kind: TS_TYPE_KIND.NAMED,
            name: 'Node',
        })

        expect(isSameTsType(
            unionOf(stringType(), nullType(), nullType()),
            unionOf(stringType(), nullType())
        )).toBe(true)

        expect(isSameTsType(
            unionOf(stringType(), nullType()),
            unionOf(nullType(), stringType())
        )).toBe(true)

        expect(isSameTsType(
            intersectionOf(namedType('User'), unionOf(namedType('Node'), namedType('AuditFields'))),
            intersectionOf(unionOf(namedType('AuditFields'), namedType('Node')), namedType('User'))
        )).toBe(true)

        expect(isSameTsType(
            intersectionOf(namedType('User'), unionOf(namedType('Node'), namedType('AuditFields'))),
            unionOf(intersectionOf(namedType('User'), namedType('Node')), namedType('AuditFields'))
        )).toBe(false)

        expect(isSameTsType(
            objectType([{ name: 'id', type: stringType() }]),
            objectType([{ name: 'id', type: numberType() }])
        )).toBe(false)
    })
})
