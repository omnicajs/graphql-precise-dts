import type { StructuralDirectivePolicies } from '../../src/directives/types'

import {
    describe,
    expect,
    test,
} from 'vitest'

import { parse } from 'graphql'
import {
    defineNamed,
    renderType,
} from '../../src'

import {
    isConditionalSelectionState,
    resolveGenerationSelectionDirectives,
    resolveStructuralSelectionDirectives,
    resolveStructuralSelectionDirectivesForNode,
    shouldForceNonNull,
} from '../../src/directives/resolve'

import {
    makeGenerationDirectivePolicies,
    makeNormalizedDirectivePolicies,
    makeStructuralDirectivePolicies,
} from '../../src/directives/structural-policies'

import { SELECTION_STATE } from '../../src/directives/kinds'
import { SELECTION_MODEL_KIND } from '../../src/kinds'

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
    const getFirstSelection = (source: string) => {
        const document = parse(source)
        const definition = document.definitions[0]

        if (!definition || definition.kind !== 'FragmentDefinition') {
            throw new Error('Fragment definition not found')
        }

        const selection = definition.selectionSet.selections[0]
        if (!selection) throw new Error('Selection not found')

        return selection
    }

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

    test('keeps defined scoped directive policies during normalization', () => {
        expect(makeNormalizedDirectivePolicies({
            required: {
                field: { effect: 'nonnull' },
                inlineFragment: undefined,
            },
        })).toEqual({
            required: {
                field: { effect: 'nonnull' },
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

    test('does not apply custom policies after runtime conditional directives are resolved', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                email @include(if: $withEmail)
            }
        `)

        expect(resolveStructuralSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD,
            makeStructuralDirectivePolicies({
                include: { effect: 'exclude' },
            })
        )).toEqual({
            directives: [ 'include' ],
            forceNonNull: false,
            state: SELECTION_STATE.CONDITIONAL,
        })
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

    test('ignores malformed non-structural policies when resolving structural directives', () => {
        const directives = getSelectionDirectives(`
            fragment UserCard on User {
                id @review
            }
        `)
        const malformedStructuralPolicies = {
            review: {
                field: { effect: 'warn' },
            },
        } as unknown as StructuralDirectivePolicies

        expect(resolveStructuralSelectionDirectives(
            directives,
            SELECTION_MODEL_KIND.FIELD,
            malformedStructuralPolicies
        )).toEqual({
            directives: [],
            forceNonNull: false,
            state: SELECTION_STATE.INCLUDED,
        })
    })

    test('resolves selections without directives as included by default', () => {
        const selection = getFirstSelection(`
            fragment UserCard on User {
                id
            }
        `)

        expect(resolveStructuralSelectionDirectivesForNode(selection)).toEqual({
            directives: [],
            forceNonNull: false,
            state: SELECTION_STATE.INCLUDED,
        })
    })

    test('resolves selection node directives using the selection kind target', () => {
        const selection = getFirstSelection(`
            fragment UserCard on User {
                id @required
            }
        `)

        expect(resolveStructuralSelectionDirectivesForNode(
            selection,
            makeStructuralDirectivePolicies({
                required: {
                    field: { effect: 'nonnull' },
                },
            })
        )).toEqual({
            directives: [],
            forceNonNull: true,
            state: SELECTION_STATE.INCLUDED,
        })
    })

    test('resolves fragment spread node directives using the fragment spread target', () => {
        const selection = getFirstSelection(`
            fragment UserCard on User {
                ...UserName @required
            }

            fragment UserName on User {
                name
            }
        `)

        expect(resolveStructuralSelectionDirectivesForNode(
            selection,
            makeStructuralDirectivePolicies({
                required: {
                    fragmentSpread: { effect: 'nonnull' },
                },
            })
        )).toEqual({
            directives: [],
            forceNonNull: true,
            state: SELECTION_STATE.INCLUDED,
        })
    })

    test('resolves inline fragment node directives using the inline fragment target', () => {
        const selection = getFirstSelection(`
            fragment UserCard on User {
                ... on User @required {
                    name
                }
            }
        `)

        expect(resolveStructuralSelectionDirectivesForNode(
            selection,
            makeStructuralDirectivePolicies({
                required: {
                    inlineFragment: { effect: 'nonnull' },
                },
            })
        )).toEqual({
            directives: [],
            forceNonNull: true,
            state: SELECTION_STATE.INCLUDED,
        })
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
