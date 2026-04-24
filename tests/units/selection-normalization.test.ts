import {
    describe,
    expect,
    test,
} from 'vitest'

import { field } from '../fixtures/builders/declaration-render'
import { normalizeSelections } from '../../src/render/selection-normalization'
import {
    listType,
    namedType,
    unionValue,
    objectValue,
    scalar,
    typenameValue,
} from '../fixtures/builders/declaration-render'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../src/models/kinds'

describe('selection normalization', () => {
    test('merges duplicate fields from the same level and nested inline fragments', () => {
        const selections = normalizeSelections([
            field('profile', objectValue([
                field('id', scalar('string'), false),
            ], [ 'User' ]), false),
            field('profile', objectValue([
                {
                    kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
                    conditional: false,
                    typeCondition: 'User',
                    selections: [
                        field('id', scalar('string'), false),
                    ],
                    directives: [],
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
                        field('id', scalar('string'), false),
                    ],
                    directives: [],
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
                ...field('user', scalar('string'), false),
                name: 'user',
                responseName: 'user',
                argumentsSignature: 'id: 1',
            },
            {
                ...field('user', scalar('string'), false),
                name: 'user',
                responseName: 'user',
                argumentsSignature: 'id: 2',
            },
        ])).toThrow(/different field arguments cannot be merged/)
    })

    test('throws when fields with the same response name target different fields', () => {
        expect(() => normalizeSelections([
            {
                ...field('name', scalar('string'), false),
                responseName: 'profileName',
            },
            {
                ...field('nickname', scalar('string'), false),
                responseName: 'profileName',
            },
        ])).toThrow(/different target fields "name" and "nickname" cannot be merged/)
    })

    test('throws when fields with the same response name have different nullability or list structure', () => {
        expect(() => normalizeSelections([
            {
                ...field('groups', scalar('string'), false, true),
                responseName: 'groups',
                typeRef: listType(false),
            },
            {
                ...field('groups', scalar('string'), false, true),
                responseName: 'groups',
                typeRef: namedType(false),
            },
        ])).toThrow(/different field nullability or list structure cannot be merged/)
    })

    test('throws when fields with the same response name have different override types', () => {
        expect(() => normalizeSelections([
            {
                ...field('id', scalar('string'), false),
                overrideTypeTs: 'OpaqueId',
            },
            {
                ...field('id', scalar('string'), false),
                overrideTypeTs: 'RawId',
            },
        ])).toThrow(/different override types cannot be merged/)
    })

    test('merges diagnostic locations, conditional flags, directives and object field values', () => {
        const selections = normalizeSelections([
            {
                ...field('profile', objectValue([
                    field('id', scalar('string'), false),
                ], [ 'User' ]), false),
                diagnosticLocation: 'group.graphql:4:5',
                directives: [ 'include' ],
                conditional: true,
            },
            {
                ...field('profile', objectValue([
                    field('name', scalar('string')),
                ], [ 'User' ]), false),
                diagnosticLocation: 'group.graphql:8:5',
                directives: [ 'client' ],
                conditional: false,
            },
        ])

        expect(selections).toEqual([expect.objectContaining({
            kind: SELECTION_MODEL_KIND.FIELD,
            responseName: 'profile',
            diagnosticLocation: 'group.graphql:4:5, group.graphql:8:5',
            conditional: false,
            directives: [ 'include', 'client' ],
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
                        fields: [ field('id', scalar('string'), false) ],
                    },
                    {
                        typeName: 'Group',
                        fields: [ field('slug', scalar('string'), false) ],
                    },
                ]), false),
            },
            {
                ...field('search', unionValue([
                    {
                        typeName: 'User',
                        fields: [ field('name', scalar('string')) ],
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

    test('deduplicates repeated fragment spreads on the same level', () => {
        const selections = normalizeSelections([
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User' ],
                conditional: false,
                directives: [],
            },
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User' ],
                conditional: false,
                directives: [ 'include' ],
            },
        ])

        expect(selections).toEqual([{
            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
            name: 'OwnerFields',
            onType: 'User',
            onTypeNames: [ 'User' ],
            conditional: false,
            directives: [ 'include' ],
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
                directives: [ 'include' ],
                diagnosticLocation: 'group.graphql:3:5',
            },
            {
                kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                name: 'OwnerFields',
                onType: 'User',
                onTypeNames: [ 'User', 'Admin' ],
                conditional: false,
                directives: [ 'client' ],
                diagnosticLocation: 'group.graphql:7:5',
            },
        ])

        expect(selections).toEqual([{
            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
            name: 'OwnerFields',
            onType: 'User',
            onTypeNames: [ 'User', 'Admin' ],
            conditional: false,
            directives: [ 'include', 'client' ],
            diagnosticLocation: 'group.graphql:3:5, group.graphql:7:5',
        }])
    })
})
