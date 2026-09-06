import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { fetchMgBotsQuery as document1, FetchMgBotsQueryPayload as Payload1, FetchMgBotsQueryVariables as Variables1 } from 'queries/bots-query.graphql'
import type { statusQuery as document2, StatusQueryPayload as Payload2, StatusQueryVariables as Variables2 } from 'queries/status.graphql'
import type { ___Query as document3, ___QueryPayload as Payload3, ___QueryVariables as Variables3 } from 'queries/underscores.graphql'
import type { fetchHttp2UsersQuery as document4, FetchHttp2UsersQueryPayload as Payload4, FetchHttp2UsersQueryVariables as Variables4 } from 'queries/users.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
    expectTypeOf<ResultOf<typeof document2>>().toEqualTypeOf<Payload2>()
    expectTypeOf<VariablesOf<typeof document2>>().toEqualTypeOf<Variables2>()
    expectTypeOf<ResultOf<typeof document3>>().toEqualTypeOf<Payload3>()
    expectTypeOf<VariablesOf<typeof document3>>().toEqualTypeOf<Variables3>()
    expectTypeOf<ResultOf<typeof document4>>().toEqualTypeOf<Payload4>()
    expectTypeOf<VariablesOf<typeof document4>>().toEqualTypeOf<Variables4>()
})
