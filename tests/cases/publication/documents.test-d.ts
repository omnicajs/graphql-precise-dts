import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { statusQuery as document1, StatusQueryPayload as Payload1, StatusQueryVariables as Variables1 } from 'queries/status.graphql'
import type { ___Query as document2, ___QueryPayload as Payload2, ___QueryVariables as Variables2 } from 'queries/underscores.graphql'
import type { fetchHttp2UsersQuery as document3, FetchHttp2UsersQueryPayload as Payload3, FetchHttp2UsersQueryVariables as Variables3 } from 'queries/users.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
    expectTypeOf<ResultOf<typeof document2>>().toEqualTypeOf<Payload2>()
    expectTypeOf<VariablesOf<typeof document2>>().toEqualTypeOf<Variables2>()
    expectTypeOf<ResultOf<typeof document3>>().toEqualTypeOf<Payload3>()
    expectTypeOf<VariablesOf<typeof document3>>().toEqualTypeOf<Variables3>()
})
