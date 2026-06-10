import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    buildVariableAliases,
    createVariableBuildState,
} from '../../../src/plan/planned/variable-planner'
import {
    operation,
    variableField,
    variableObjectValue,
} from '../../fixtures/builders/declaration-render'

import { OperationTypeNode } from 'graphql'

describe('variable planner', () => {
    test('builds an alias from an in-progress object variable that is not cached yet', () => {
        const state = createVariableBuildState(baseName => baseName)
        const treeInput = variableObjectValue([
            variableField('children', variableObjectValue([], 'TreeInput', true), true, true),
        ], 'TreeInput')

        state.inProgress.add('TreeInput')

        expect(buildVariableAliases(new Map([
            ['CreateTree', operation(
                OperationTypeNode.MUTATION,
                [],
                [ variableField('input', treeInput, false, false, false) ],
                'Mutation'
            )],
        ]), state, {})).toEqual([{
            typeName: 'TreeInput',
            aliasName: 'TreeInputAlias',
            fields: [],
        }])
    })
})
