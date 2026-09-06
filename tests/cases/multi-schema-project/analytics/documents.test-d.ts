import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { dashboardQuery as document1, DashboardQueryPayload as Payload1, DashboardQueryVariables as Variables1 } from 'analytics/dashboard.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
