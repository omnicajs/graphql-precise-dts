import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { searchQuery as document1, SearchQueryPayload as Payload1, SearchQueryVariables as Variables1 } from 'queries/search.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
