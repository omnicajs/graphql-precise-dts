import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { fetch_users_query as document1, fetch_users_queryPayload as Payload1, fetch_users_queryVariables as Variables1 } from 'queries/fetch_users.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
