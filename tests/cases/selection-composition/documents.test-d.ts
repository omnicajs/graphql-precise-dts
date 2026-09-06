import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { viewerQuery as document1, ViewerQueryPayload as Payload1, ViewerQueryVariables as Variables1 } from 'queries/viewer.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
