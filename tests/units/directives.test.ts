import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    defineNamed,
    renderType,
} from '../../src'
import { isConditionalSelectionState } from '../../src/directives/resolve'
import { parse } from 'graphql'
import {
    makeGenerationDirectivePolicies,
    makeNormalizedDirectivePolicies,
    makeStructuralDirectivePolicies,
} from '../../src/directives/structural-policies'
import {
    resolveGenerationSelectionDirectives,
    resolveStructuralSelectionDirectives,
    shouldForceNonNull,
} from '../../src/directives/resolve'

import { SELECTION_MODEL_KIND } from '../../src/kinds'
import { SELECTION_STATE } from '../../src/directives/kinds'

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
    test('normalizes flat and scoped directive policies by selection kind', () => {
        expect(makeNormalizedDirectivePolicies({
            review: {
                effect: 'warn',
                message: 'Review this field',
            },
            mask: {
                field: { effect: 'conditional' },
            },
        })).toEqual({
            review: {
                field: {
                    effect: 'warn',
                    message: 'Review this field',
                },
                fragmentSpread: {
                    effect: 'warn',
                    message: 'Review this field',
                },
                inlineFragment: {
                    effect: 'warn',
                    message: 'Review this field',
                },
            },
            mask: {
                field: { effect: 'conditional' },
            },
        })
    })

    test('marks runtime include directives as conditional', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @include(if: $withEmail)
            }
        `)

        const resolved = resolveStructuralSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD
        )

        expect(resolved).toEqual({
            directives: [ 'include' ],
            forceNonNull: false,
            state: SELECTION_STATE.CONDITIONAL,
        })
        expect(isConditionalSelectionState(resolved.state)).toBe(true)
    })

    test('excludes statically skipped selections', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @skip(if: true)
            }
        `)

        expect(resolveStructuralSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            forceNonNull: false,
            state: SELECTION_STATE.EXCLUDED,
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

        expect(resolveStructuralSelectionDirectives(
            includeDirectives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            forceNonNull: false,
            state: SELECTION_STATE.INCLUDED,
        })

        expect(resolveStructuralSelectionDirectives(
            skipDirectives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            forceNonNull: false,
            state: SELECTION_STATE.INCLUDED,
        })
    })

    test('excludes statically non-included selections', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @include(if: false)
            }
        `)

        expect(resolveStructuralSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD
        )).toEqual({
            directives: [],
            forceNonNull: false,
            state: SELECTION_STATE.EXCLUDED,
        })
    })

    test('applies scoped directive policies with override, warn and nonnull', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                id @opaque @review @required
            }
        `)

        const structural = resolveStructuralSelectionDirectives(directives, SELECTION_MODEL_KIND.FIELD, {
            ...makeStructuralDirectivePolicies({
                opaque: {
                    effect: 'override-type',
                    type: defineNamed('OpaqueId'),
                },
                review: {
                    effect: 'warn',
                    message: 'Review this field',
                },
                required: {
                    effect: 'nonnull',
                },
            }),
        })

        expect(structural).toEqual({
            directives: [],
            forceNonNull: true,
            state: SELECTION_STATE.INCLUDED,
        })

        const generation = resolveGenerationSelectionDirectives(
            directives.map(directive => directive.name.value),
            SELECTION_MODEL_KIND.FIELD,
            makeGenerationDirectivePolicies({
                opaque: {
                    effect: 'override-type',
                    type: defineNamed('OpaqueId'),
                },
                review: {
                    effect: 'warn',
                    message: 'Review this field',
                },
                required: {
                    effect: 'nonnull',
                },
            })
        )

        expect(generation).toEqual({
            directives: [ 'opaque', 'review' ],
            overrideType: defineNamed('OpaqueId'),
            warnings: [ 'Review this field' ],
        })

        expect(shouldForceNonNull(
            directives,
            SELECTION_MODEL_KIND.FIELD,
            makeStructuralDirectivePolicies({
                required: { effect: 'nonnull' },
            })
        )).toBe(true)

        expect(shouldForceNonNull(
            directives,
            SELECTION_MODEL_KIND.INLINE_FRAGMENT,
            makeStructuralDirectivePolicies({
                required: { effect: 'nonnull' },
            })
        )).toBe(true)
    })

    test('uses the default warning message when warn policy message is omitted', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                id @review
            }
        `)

        expect(resolveGenerationSelectionDirectives(
            directives.map(directive => directive.name.value),
            SELECTION_MODEL_KIND.FIELD,
            makeGenerationDirectivePolicies({
                review: {
                    effect: 'warn',
                },
            })
        )).toEqual({
            directives: [ 'review' ],
            warnings: [ 'Directive "@review" requires manual review' ],
        })
    })

    test('accepts structured override-type policies', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                id @opaque
            }
        `)

        const resolved = resolveGenerationSelectionDirectives(
            directives.map(directive => directive.name.value),
            SELECTION_MODEL_KIND.FIELD,
            makeGenerationDirectivePolicies({
                opaque: {
                    effect: 'override-type',
                    type: defineNamed('UserId'),
                },
            })
        )

        expect(renderType(resolved.overrideType!)).toBe('UserId')
    })
})
