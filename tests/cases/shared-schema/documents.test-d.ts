import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { customerQuery as document1, CustomerQueryPayload as Payload1, CustomerQueryVariables as Variables1 } from 'queries/customer.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
