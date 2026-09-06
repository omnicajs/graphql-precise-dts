import type { ViewerQueryPayload, ViewerQueryVariables } from 'viewer.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<ViewerQueryPayload>().toEqualTypeOf<{ __typename?: 'Query'; viewer: string }>()
    expectTypeOf<ViewerQueryVariables>().toEqualTypeOf<Record<string, never>>()
    // @ts-expect-error The schema makes viewer non-null.
    const invalid: ViewerQueryPayload = { viewer: null }
    void invalid
})
