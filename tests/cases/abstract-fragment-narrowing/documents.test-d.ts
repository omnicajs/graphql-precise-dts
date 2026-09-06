import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { onlyAQuery as document1, OnlyAQueryPayload as Payload1, OnlyAQueryVariables as Variables1 } from 'only-a.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
