import type { SearchQueryVariables, SearchQueryPayload } from 'queries/search.graphql'
import { SearchMode } from '@search/graphql/enums'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<SearchQueryPayload['search']>().toEqualTypeOf<boolean>()
    const recursive: SearchQueryVariables = { nested: { nested: { label: null } }, choice: { id: '1' } }
    // @ts-expect-error A oneOf input cannot supply both alternatives.
    const both: SearchQueryVariables = { choice: { id: '1', mode: SearchMode.EXACT } }
    // @ts-expect-error A oneOf input must supply one alternative.
    const neither: SearchQueryVariables = { choice: {} }
    void recursive; void both; void neither
})
