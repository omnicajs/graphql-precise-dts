import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { nodeQuery as document1, NodeQueryPayload as Payload1, NodeQueryVariables as Variables1 } from 'queries/node.graphql'
import type { searchQuery as document2, SearchQueryPayload as Payload2, SearchQueryVariables as Variables2 } from 'queries/search.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
    expectTypeOf<ResultOf<typeof document2>>().toEqualTypeOf<Payload2>()
    expectTypeOf<VariablesOf<typeof document2>>().toEqualTypeOf<Variables2>()
})
