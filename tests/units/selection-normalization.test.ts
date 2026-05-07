import {
    describe,
    expect,
    test,
} from 'vitest'

import { defineString } from '../../src'
import { normalizeSelections } from '../../src/plan/planned/normalize/selection'
import {
    field,
    listType,
    namedType,
    objectValue,
    scalar,
    typenameValue,
    unionValue,
} from '../fixtures/builders/declaration-render'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../src/kinds'

describe('selection normalization', () => {
    test('merges duplicate fields from the same level and nested inline fragments', () => {
        const selections = normalizeSelections([
            field('profile', objectValue([
                field('id', scalar(defineString()), false),
            ], [ 'User' ]), false),
            field('profile', objectValue([
                {
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    conditional: false,
                    typeCondition: 'User',
                    selections: [
                        field('id', scalar(defineString()), false),
                    ],
                },
            ], [ 'User' ]), false),
        ])

        expect(selections).toHaveLength(1)
        expect(selections[0]).toMatchObject({
            kind: SELECTION_MODEL_KIND.FIELD,
            responseName: 'profile',
            conditional: false,
        })
        expect(selections[0].kind === SELECTION_MODEL_KIND.FIELD && selections[0].value.kind === VALUE_MODEL_KIND.OBJECT
            ? selections[0].value.fields
            : []).toHaveLength(1)
    })

    test('keeps inline fragment selections untouched without a merge target', () => {
        const selections = normalizeSelections([
            field('profile', objectValue([
                {
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    conditional: false,
                    typeCondition: 'User',
                    selections: [
                        field('id', scalar(defineString()), false),
                    ],
                },
            ], [ 'User' ]), false),
        ])

        expect(selections).toHaveLength(1)
        expect(selections[0].kind === SELECTION_MODEL_KIND.FIELD && selections[0].value.kind === VALUE_MODEL_KIND.OBJECT
            ? selections[0].value.fields
            : []).toHaveLength(1)
    })

    test('throws when fields with the same response name have different arguments', () => {
        expect(() => normalizeSelections([
            {
                ...field('user', scalar(defineString()), false),
                name: 'user',
                responseName: 'user',
                argumentsSignature: 'id: 1',
            },
            {
                ...field('user', scalar(defineString()), false),
                name: 'user',
                responseName: 'user',
                argumentsSignature: 'id: 2',
            },
        ])).toThrow(/different field arguments cannot be merged/)
    })

    test('throws when fields with the same response name target different fields', () => {
        expect(() => normalizeSelections([
            {
                ...field('name', scalar(defineString()), false),
                responseName: 'profileName',
            },
            {
                ...field('nickname', scalar(defineString()), false),
                responseName: 'profileName',
            },
        ])).toThrow(/different target fields "name" and "nickname" cannot be merged/)
    })

    test('throws when fields with the same response name have different nullability or list structure', () => {
        expect(() => normalizeSelections([
            {
                ...field('groups', scalar(defineString()), false, true),
                responseName: 'groups',
                typeRef: listType(false),
            },
            {
                ...field('groups', scalar(defineString()), false, true),
                responseName: 'groups',
                typeRef: namedType(false),
            },
        ])).toThrow(/different field nullability or list structure cannot be merged/)
    })

    test('merges diagnostic locations, conditional flags, directive names and object field values', () => {
        const selections = normalizeSelections([
            {
                ...field('profile', objectValue([
                    field('id', scalar(defineString()), false),
                ], [ 'User' ]), false),
                diagnosticLocation: 'group.graphql:4:5',
                directiveNames: [ 'include' ],
                conditional: true,
            },
            {
                ...field('profile', objectValue([
                    field('name', scalar(defineString())),
                ], [ 'User' ]), false),
                diagnosticLocation: 'group.graphql:8:5',
                directiveNames: [ 'client' ],
                conditional: false,
            },
        ])

        expect(selections).toEqual([expect.objectContaining({
            kind: SELECTION_MODEL_KIND.FIELD,
            responseName: 'profile',
            diagnosticLocation: 'group.graphql:4:5, group.graphql:8:5',
            conditional: false,
            directiveNames: [ 'include', 'client' ],
            value: {
                kind: VALUE_MODEL_KIND.OBJECT,
                typeNames: [ 'User' ],
                fields: [
                    expect.objectContaining({ responseName: 'id' }),
                    expect.objectContaining({ responseName: 'name' }),
                ],
            },
        })])
    })

    test('propagates parent conditional flags to nested object selections before merge', () => {
        const selections = normalizeSelections([
            field('user', objectValue([
                field('name', scalar(defineString()), false),
            ], [ 'User' ]), false),
            {
                ...field('user', objectValue([
                    field('id', scalar(defineString()), false),
                ], [ 'User' ]), false),
                conditional: true,
            },
        ])

        expect(selections).toMatchObject([{
            responseName: 'user',
            conditional: false,
            value: {
                kind: VALUE_MODEL_KIND.OBJECT,
                fields: [
                    {
                        responseName: 'name',
                        conditional: false,
                    },
                    {
                        responseName: 'id',
                        conditional: true,
                    },
                ],
            },
        }])
    })

    test('merges typename values by combining unique type names', () => {
        const selections = normalizeSelections([
            {
                ...field('__typename', typenameValue('UserPayload'), false),
                diagnosticLocation: 'a.graphql:1:1',
            },
            {
                ...field('__typename', typenameValue('AdminPayload'), false),
                diagnosticLocation: 'a.graphql:2:1',
            },
        ])

        expect(selections).toEqual([expect.objectContaining({
            responseName: '__typename',
            diagnosticLocation: 'a.graphql:1:1, a.graphql:2:1',
            value: {
                kind: VALUE_MODEL_KIND.TYPENAME,
                typeNames: [ 'UserPayload', 'AdminPayload' ],
            },
        })])
    })

    test('merges union values by combining and normalizing variants', () => {
        const selections = normalizeSelections([
            {
                ...field('search', unionValue([
                    {
                        typeName: 'User',
                        fields: [ field('id', scalar(defineString()), false) ],
                    },
                    {
                        typeName: 'Group',
                        fields: [ field('slug', scalar(defineString()), false) ],
                    },
                ]), false),
            },
            {
                ...field('search', unionValue([
                    {
                        typeName: 'User',
                        fields: [ field('name', scalar(defineString())) ],
                    },
                ]), false),
            },
        ])

        expect(selections).toEqual([expect.objectContaining({
            responseName: 'search',
            value: {
                kind: VALUE_MODEL_KIND.UNION,
                variants: [
                    {
                        typeName: 'User',
                        fields: [
                            expect.objectContaining({ responseName: 'id' }),
                            expect.objectContaining({ responseName: 'name' }),
                        ],
                    },
                    {
                        typeName: 'Group',
                        fields: [
                            expect.objectContaining({ responseName: 'slug' }),
                        ],
                    },
                ],
            },
        })])
    })

    test('propagates parent conditional flags to nested union variant selections before merge', () => {
        const selections = normalizeSelections([
            field('search', unionValue([
                {
                    typeName: 'User',
                    fields: [ field('name', scalar(defineString()), false) ],
                },
            ]), false),
            {
                ...field('search', unionValue([
                    {
                        typeName: 'User',
                        fields: [ field('id', scalar(defineString()), false) ],
                    },
                ]), false),
                conditional: true,
            },
        ])

        expect(selections).toMatchObject([{
            responseName: 'search',
            conditional: false,
            value: {
                kind: VALUE_MODEL_KIND.UNION,
                variants: [
                    {
                        typeName: 'User',
                        fields: [
                            {
                                responseName: 'name',
                                conditional: false,
                            },
                            {
                                responseName: 'id',
                                conditional: true,
                            },
                        ],
                    },
                ],
            },
        }])
    })

    test('deduplicates repeated fragment spreads on the same level', () => {
        const selections = normalizeSelections([
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User' ],
                conditional: false,
            },
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User' ],
                conditional: false,
                directiveNames: [ 'include' ],
            },
        ])

        expect(selections).toEqual([{
            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
            name: 'OwnerFields',
            onType: 'User',
            onTypeNames: [ 'User' ],
            conditional: false,
            directiveNames: [ 'include' ],
            diagnosticLocation: undefined,
        }])
    })

    test('merges fragment spread metadata', () => {
        const selections = normalizeSelections([
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User', 'Admin' ],
                conditional: true,
                directiveNames: [ 'include' ],
                diagnosticLocation: 'group.graphql:3:5',
            },
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User', 'Admin' ],
                conditional: false,
                directiveNames: [ 'client' ],
                diagnosticLocation: 'group.graphql:7:5',
            },
        ])

        expect(selections).toEqual([{
            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
            name: 'OwnerFields',
            onType: 'User',
            onTypeNames: [ 'User', 'Admin' ],
            conditional: false,
            directiveNames: [ 'include', 'client' ],
            diagnosticLocation: 'group.graphql:3:5, group.graphql:7:5',
        }])
    })
})
