import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { skippedFirstQuery as document1, SkippedFirstQueryPayload as Payload1, SkippedFirstQueryVariables as Variables1 } from 'queries/skipped.graphql'
import type { selectedFirstQuery as document2, SelectedFirstQueryPayload as Payload2, SelectedFirstQueryVariables as Variables2 } from 'queries/skipped.graphql'
import type { bothSkippedQuery as document3, BothSkippedQueryPayload as Payload3, BothSkippedQueryVariables as Variables3 } from 'queries/skipped.graphql'
import type { nestedSkippedFirstQuery as document4, NestedSkippedFirstQueryPayload as Payload4, NestedSkippedFirstQueryVariables as Variables4 } from 'queries/skipped.graphql'
import type { nestedSelectedFirstQuery as document5, NestedSelectedFirstQueryPayload as Payload5, NestedSelectedFirstQueryVariables as Variables5 } from 'queries/skipped.graphql'
import type { userQuery as document6, UserQueryPayload as Payload6, UserQueryVariables as Variables6 } from 'queries/user.graphql'

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
    expectTypeOf<ResultOf<typeof document5>>().toEqualTypeOf<Payload5>()
    expectTypeOf<VariablesOf<typeof document5>>().toEqualTypeOf<Variables5>()
    expectTypeOf<ResultOf<typeof document6>>().toEqualTypeOf<Payload6>()
    expectTypeOf<VariablesOf<typeof document6>>().toEqualTypeOf<Variables6>()
})
