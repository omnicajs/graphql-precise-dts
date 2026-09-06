import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { dashboardUsersQuery as document1, DashboardUsersQueryPayload as Payload1, DashboardUsersQueryVariables as Variables1 } from 'mixed/dashboard.graphql'
import type { dashboardGroupsQuery as document2, DashboardGroupsQueryPayload as Payload2, DashboardGroupsQueryVariables as Variables2 } from 'mixed/dashboard.graphql'
import type { groupsQuery as document3, GroupsQueryPayload as Payload3, GroupsQueryVariables as Variables3 } from 'queries/groups.graphql'
import type { usersQuery as document4, UsersQueryPayload as Payload4, UsersQueryVariables as Variables4 } from 'queries/users.graphql'

import { expectTypeOf, test } from 'vitest'

test('infers the result and variables of every exported document', () => {
    expectTypeOf<ResultOf<typeof document1>>().toEqualTypeOf<Payload1>()
    expectTypeOf<VariablesOf<typeof document1>>().toEqualTypeOf<Variables1>()
    expectTypeOf<ResultOf<typeof document2>>().toEqualTypeOf<Payload2>()
    expectTypeOf<VariablesOf<typeof document2>>().toEqualTypeOf<Variables2>()
    expectTypeOf<ResultOf<typeof document3>>().toEqualTypeOf<Payload3>()
    expectTypeOf<VariablesOf<typeof document3>>().toEqualTypeOf<Variables3>()
    expectTypeOf<ResultOf<typeof document4>>().toEqualTypeOf<Payload4>()
    expectTypeOf<VariablesOf<typeof document4>>().toEqualTypeOf<Variables4>()
})
