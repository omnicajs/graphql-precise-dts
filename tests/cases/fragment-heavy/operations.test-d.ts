import type { UsersQueryPayload } from 'queries/users.graphql'
import type { GroupsQueryPayload } from 'queries/groups.graphql'
import type { DashboardGroupsQueryPayload, DashboardUsersQueryPayload } from 'mixed/dashboard.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<UsersQueryPayload['users'][number]['groups'][number]['owner']['name']>().toEqualTypeOf<string>()
    expectTypeOf<GroupsQueryPayload['groups'][number]['members'][number]['id']>().toEqualTypeOf<string>()
    expectTypeOf<DashboardGroupsQueryPayload['groups'][number]['owner']['name']>().toEqualTypeOf<string>()
    expectTypeOf<DashboardUsersQueryPayload['users'][number]['id']>().toEqualTypeOf<string>()
    // @ts-expect-error UserGroups requires the transitive groups field.
    const incomplete: UsersQueryPayload = { users: [{ id: '1', name: 'Ada' }] }
    void incomplete
})
