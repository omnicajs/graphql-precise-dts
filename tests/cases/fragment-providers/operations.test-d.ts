import type { UserDetailsQueryPayload } from 'queries/user.graphql'
import type { GroupDetailsQueryPayload } from 'queries/group.graphql'
import type { LocalDetailsQueryPayload } from 'mixed/local.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<UserDetailsQueryPayload['user']['username']>().toEqualTypeOf<string>()
    expectTypeOf<GroupDetailsQueryPayload['group']['title']>().toEqualTypeOf<string>()
    expectTypeOf<LocalDetailsQueryPayload['user']>().toExtend<{ id: string }>()
    // @ts-expect-error The local SharedDetails does not select username.
    const wrongProvider: LocalDetailsQueryPayload = { user: { id: '1', username: 'Ada' } }
    // @ts-expect-error The user provider cannot be replaced with the group provider.
    const wrongEntity: UserDetailsQueryPayload = { user: { id: '1', title: 'Team' } }
    void wrongProvider; void wrongEntity
})
