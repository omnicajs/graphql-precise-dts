import type { ViewerQueryPayload } from 'viewer.graphql'
import type { ComposedQueryPayload } from 'composed.graphql'
import type { TransitiveQueryPayload } from 'transitive.graphql'
import type { ConditionalNodeQueryPayload } from 'abstract.graphql'

import { expectTypeOf, test } from 'vitest'

test('keeps unconditional fields required and conditional fragments optional', () => {
    expectTypeOf<NonNullable<ViewerQueryPayload['user']>>().toEqualTypeOf<{ __typename?: 'User'; id: string; name?: string }>()
    expectTypeOf<NonNullable<ComposedQueryPayload['user']>>().toEqualTypeOf<{ __typename?: 'User'; id: string; name?: string }>()
    expectTypeOf<NonNullable<TransitiveQueryPayload['user']>>().toEqualTypeOf<{ __typename?: 'User'; id: string; name?: string }>()
    // @ts-expect-error Conditional name cannot make the unconditional id optional.
    const missingBase: ComposedQueryPayload = { user: { name: 'Ada' } }
    // @ts-expect-error Conditional variants must retain their discriminant.
    const wrongVariant: ConditionalNodeQueryPayload = { node: { __typename: 'B', a: 'A only' } }
    void missingBase
    void wrongVariant
})
