import type { UserQueryPayload, UserQueryVariables } from 'queries/user.graphql'
import type { SameNameQueryPayload } from 'same-name.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<UserQueryVariables>().toEqualTypeOf<{ id: string; details: boolean }>()
    expectTypeOf<NonNullable<UserQueryPayload['user']>['name']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<SameNameQueryPayload['__typename']>().toEqualTypeOf<'Query'>()
    // @ts-expect-error Variables used inside an imported fragment are still required.
    const missingDetails: UserQueryVariables = { id: '1' }
    void missingDetails
})
