import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    buildFragmentModel,
    buildOutputAliases,
    createOutputBuildState,
} from '../../../src/plan/planned/output-planner'
import {
    field,
    fragment,
    objectValue,
    scalar,
} from '../../fixtures/builders/declaration-render'
import { defineString } from '../../../src'

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
            {},
            () => undefined
        )

        const aliases = buildOutputAliases(state.occurrences, baseName => baseName)

        expect(aliases).toEqual([expect.objectContaining({
            aliasName: 'TreeAlias',
            typeNames: [ 'Tree' ],
        })])
        expect(aliases[0]?.fields).toHaveLength(2)
    })
})
