import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import {
    buildFragmentModel,
    buildOutputAliases,
    createOutputBuildState,
} from '../../../src/plan/planned/output-planner'
import { createNamingConvention } from '../../../src/naming'
import {
    field,
    fragment,
    objectValue,
    scalar,
} from '../../fixtures/builders/declaration-render'
import { defineString } from '../../../src'

import { DIRECTIVE_POLICY_EFFECT } from '../../../src/directives/kinds'
import { SELECTION_MODEL_KIND } from '../../../src/kinds'

describe('output planner', () => {
    test('marks structurally recursive object occurrences when matching shapes are already in progress', () => {
        const state = createOutputBuildState()
        const leftTree = objectValue([], [ 'Tree' ])
        const rightTree = objectValue([], [ 'Tree' ])

        leftTree.fields.push(
            field('value', scalar(defineString())),
            field('children', rightTree, true, true)
        )
        rightTree.fields.push(
            field('value', scalar(defineString())),
            field('children', leftTree, true, true)
        )

        buildFragmentModel(
            fragment([
                field('root', leftTree, false),
            ], 'Query'),
            state,
            {},
            createNamingConvention(),
            {}
        )

        const aliases = buildOutputAliases(state.occurrences, baseName => baseName)

        expect(aliases).toEqual([expect.objectContaining({
            aliasName: 'TreeAlias',
            typeNames: [ 'Tree' ],
        })])
        expect(aliases[0]?.fields).toHaveLength(2)
    })

    test('uses the default warning reporter', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        buildFragmentModel(
            fragment([
                {
                    ...field('name', scalar(defineString()), false),
                    directiveNames: [ 'review' ],
                },
            ], 'Query'),
            createOutputBuildState(),
            {},
            createNamingConvention(),
            {
                review: {
                    [SELECTION_MODEL_KIND.FIELD]: {
                        effect: DIRECTIVE_POLICY_EFFECT.WARN,
                        message: 'Review generated declaration.',
                    },
                },
            }
        )

        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith('Review generated declaration.')

        warn.mockRestore()
    })
})
