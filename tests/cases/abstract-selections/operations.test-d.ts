import type { NodeQueryPayload, NodeQueryVariables } from 'queries/node.graphql'
import type { SearchQueryPayload, SearchQueryVariables } from 'queries/search.graphql'
import type { SearchScope } from '@search/graphql/enums'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<NodeQueryVariables>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<NonNullable<NodeQueryPayload['node']>['__typename']>().toEqualTypeOf<'User' | 'Team'>()
    expectTypeOf<Extract<NonNullable<NodeQueryPayload['node']>, { __typename: 'User' }>['name']>().toEqualTypeOf<string>()
    expectTypeOf<SearchQueryVariables['filter']['scope']>().toEqualTypeOf<SearchScope | null | undefined>()
    const skipped: SearchQueryPayload = {}
    // @ts-expect-error The alias is results, not search.
    const originalName: SearchQueryPayload = { search: [] }
    // @ts-expect-error The User variant does not have Team.title.
    const invalidVariant: NodeQueryPayload = { node: { __typename: 'User', id: '1', updatedAt: '', title: 'team' } }
    void skipped; void originalName; void invalidVariant
})
