import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { userQuery as document1, UserQueryPayload as Payload1, UserQueryVariables as Variables1 } from 'queries/user.graphql'
import type { sameNameQuery as document2, SameNameQueryPayload as Payload2, SameNameQueryVariables as Variables2 } from 'same-name.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
    expectTypeOf<ResultOf<typeof document2>>().toEqualTypeOf<Payload2>()
    expectTypeOf<VariablesOf<typeof document2>>().toEqualTypeOf<Variables2>()
})
