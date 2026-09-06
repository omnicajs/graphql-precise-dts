import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { conditionalNodeQuery as document1, ConditionalNodeQueryPayload as Payload1, ConditionalNodeQueryVariables as Variables1 } from 'abstract.graphql'
import type { composedQuery as document2, ComposedQueryPayload as Payload2, ComposedQueryVariables as Variables2 } from 'composed.graphql'
import type { transitiveQuery as document3, TransitiveQueryPayload as Payload3, TransitiveQueryVariables as Variables3 } from 'transitive.graphql'
import type { viewerQuery as document4, ViewerQueryPayload as Payload4, ViewerQueryVariables as Variables4 } from 'viewer.graphql'

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
