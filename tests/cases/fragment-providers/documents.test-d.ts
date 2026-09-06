import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { localDetailsQuery as document1, LocalDetailsQueryPayload as Payload1, LocalDetailsQueryVariables as Variables1 } from 'mixed/local.graphql'
import type { groupDetailsQuery as document2, GroupDetailsQueryPayload as Payload2, GroupDetailsQueryVariables as Variables2 } from 'queries/group.graphql'
import type { userDetailsQuery as document3, UserDetailsQueryPayload as Payload3, UserDetailsQueryVariables as Variables3 } from 'queries/user.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
    expectTypeOf<ResultOf<typeof document2>>().toEqualTypeOf<Payload2>()
    expectTypeOf<VariablesOf<typeof document2>>().toEqualTypeOf<Variables2>()
    expectTypeOf<ResultOf<typeof document3>>().toEqualTypeOf<Payload3>()
    expectTypeOf<VariablesOf<typeof document3>>().toEqualTypeOf<Variables3>()
})
