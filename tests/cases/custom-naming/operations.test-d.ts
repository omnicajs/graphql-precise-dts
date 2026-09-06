import type { userFields } from 'fragments/user_fields.graphql'
import type { fetch_users_queryPayload, fetch_users_queryVariables } from 'queries/fetch_users.graphql'
import type { user_status } from '@naming/enums'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<userFields>().toEqualTypeOf<{ __typename?: 'UserProfile'; id: string; status: user_status }>()
    expectTypeOf<fetch_users_queryVariables>().toEqualTypeOf<{ status?: user_status | null }>()
    expectTypeOf<fetch_users_queryPayload['users'][number]['id']>().toEqualTypeOf<string>()
    // @ts-expect-error The fragment requires status as well as id.
    const missingStatus: fetch_users_queryPayload = { users: [{ id: '1' }] }
    void missingStatus
})
