import type { SearchQueryPayload, SearchQueryVariables } from 'queries/search.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<SearchQueryVariables>().toEqualTypeOf<Record<string, never>>()
    expectTypeOf<SearchQueryPayload['search'][number]>().toEqualTypeOf<{ __typename?: 'SearchResult'; id: string }>()
    // @ts-expect-error Literal arguments do not become operation variables.
    const extra: SearchQueryVariables = { limit: 10 }
    void extra
})
