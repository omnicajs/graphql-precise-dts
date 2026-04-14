import {
    describe,
    expect,
    test,
} from 'vitest'

import { isConditionalSelectionState } from '../../src/directives'
import { parse } from 'graphql'
import {
    resolveSelectionDirectives,
    shouldForceNonNull,
} from '../../src/directives'

import { SELECTION_MODEL_KIND } from '../../src/models/kinds'
import { SELECTION_STATE } from '../../src/directives'

const getSelectionDirectives = (source: string) => {
    const document = parse(source)
    const definition = document.definitions[0]

    if (!definition || definition.kind !== 'FragmentDefinition') {
        throw new Error('Fragment definition not found')
    }

    const selection = definition.selectionSet.selections[0]
    if (!selection) throw new Error('Selection not found')

    return selection.directives ? [ ...selection.directives ] : []
}

describe('directives', () => {
    test('marks runtime include directives as conditional', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @include(if: $withEmail)
            }
        `)

        const resolved = resolveSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD
        )

        expect(resolved).toEqual({
            directives: [ 'include' ],
            state: SELECTION_STATE.CONDITIONAL,
            warnings: [],
        })
        expect(isConditionalSelectionState(resolved.state)).toBe(true)
    })

    test('excludes statically skipped selections', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @skip(if: true)
            }
        `)

        expect(resolveSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            state: SELECTION_STATE.EXCLUDED,
            warnings: [],
        })
    })

    test('keeps statically included and non-skipped selections without marking them conditional', () => {
        const includeDirectives = getSelectionDirectives(`
            fragment UserCard on User {
                email @include(if: true)
            }
        `)
        const skipDirectives = getSelectionDirectives(`
            fragment UserCard on User {
                email @skip(if: false)
            }
        `)

        expect(resolveSelectionDirectives(
            includeDirectives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            state: SELECTION_STATE.INCLUDED,
            warnings: [],
        })

        expect(resolveSelectionDirectives(
            skipDirectives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            state: SELECTION_STATE.INCLUDED,
            warnings: [],
        })
    })

    test('excludes statically non-included selections', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @include(if: false)
            }
        `)

        expect(resolveSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            state: SELECTION_STATE.EXCLUDED,
            warnings: [],
        })
    })

    test('applies scoped directive policies with override, warn and nonnull', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                id @opaque @review @required
            }
        `)

        const resolved = resolveSelectionDirectives(directives, SELECTION_MODEL_KIND.FIELD, {
            opaque: {
                field: {
                    effect: 'override-type',
                    type: 'OpaqueId',
                },
            },
            review: {
                field: {
                    effect: 'warn',
                    message: 'Review this field',
                },
            },
            required: {
                field: {
                    effect: 'nonnull',
                },
            },
        })

        expect(resolved).toEqual({
            directives: [],
            overrideTypeTs: 'OpaqueId',
            state: SELECTION_STATE.INCLUDED,
            warnings: [ 'Review this field' ],
        })

        expect(shouldForceNonNull(
            directives,
            SELECTION_MODEL_KIND.FIELD,
            {
                required: {
                    field: { effect: 'nonnull' },
                },
            }
        )).toBe(true)

        expect(shouldForceNonNull(
            directives,
            SELECTION_MODEL_KIND.INLINE_FRAGMENT,
            {
                required: {
                    field: { effect: 'nonnull' },
                },
            }
        )).toBe(false)
    })

    test('uses the default warning message when warn policy message is omitted', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                id @review
            }
        `)

        expect(resolveSelectionDirectives(directives, SELECTION_MODEL_KIND.FIELD, {
            review: {
                field: {
                    effect: 'warn',
                },
            },
        })).toEqual({
            directives: [],
            state: SELECTION_STATE.INCLUDED,
            warnings: [ 'Directive "@review" requires manual review' ],
        })
    })
})
