import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { directiveEffectsQuery as document1, DirectiveEffectsQueryPayload as Payload1, DirectiveEffectsQueryVariables as Variables1 } from 'directives.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
})
