import type { SearchQueryPayload, SearchQueryVariables } from 'queries/search.graphql'
import type { QuerySearchArgs, Scalars } from '@app/graphql/schema'
import { Status } from '@app/graphql/enums'

import { expectTypeOf, test } from 'vitest'

test('preserves schema inputs, enum identity, and discriminated results', () => {
    expectTypeOf<Scalars['DateTime']>().toEqualTypeOf<{ input: string; output: string }>()
    expectTypeOf<QuerySearchArgs['range']>().toEqualTypeOf<SearchQueryVariables['range']>()
    expectTypeOf<SearchQueryPayload['search'][number]['__typename']>().toEqualTypeOf<'User' | 'Team'>()
    // @ts-expect-error oneOf rejects both alternatives even though each is valid individually.
    const both: SearchQueryVariables = { filter: { term: 'Ada', status: Status.ACTIVE } }
    // @ts-expect-error A range still requires its lower bound.
    const missingFrom: SearchQueryVariables = { range: { to: 1 } }
    // @ts-expect-error User fields do not belong to a Team result.
    const wrongVariant: SearchQueryPayload = { search: [{ __typename: 'Team', id: '1', name: 'Ada' }] }
    void both
    void missingFrom
    void wrongVariant
})
