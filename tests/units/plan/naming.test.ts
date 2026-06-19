import {
    describe,
    expect,
    test,
} from 'vitest'

import { getOperationTypeName } from '../../../src/plan/naming'
import { OperationTypeNode } from 'graphql'

describe('plan naming', () => {
    test('builds operation type names without a naming convention', () => {
        expect(getOperationTypeName('getUser', OperationTypeNode.QUERY)).toBe('GetUserQuery')
    })
})
