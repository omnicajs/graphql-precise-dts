import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { addGroupMutation as document1, AddGroupMutationPayload as Payload1, AddGroupMutationVariables as Variables1 } from '~tests/fixtures/documents/mutations/addGroup.graphql'
import type { changeOwnerMutation as document2, ChangeOwnerMutationPayload as Payload2, ChangeOwnerMutationVariables as Variables2 } from '~tests/fixtures/documents/mutations/changeOwner.graphql'
import type { createUserMutation as document3, CreateUserMutationPayload as Payload3, CreateUserMutationVariables as Variables3 } from '~tests/fixtures/documents/mutations/createUser.graphql'
import type { removeGroupMutation as document4, RemoveGroupMutationPayload as Payload4, RemoveGroupMutationVariables as Variables4 } from '~tests/fixtures/documents/mutations/removeGroup.graphql'
import type { groupMembersQuery as document5, GroupMembersQueryPayload as Payload5, GroupMembersQueryVariables as Variables5 } from '~tests/fixtures/documents/queries/groupMembers.graphql'
import type { ownerGroupQuery as document6, OwnerGroupQueryPayload as Payload6, OwnerGroupQueryVariables as Variables6 } from '~tests/fixtures/documents/queries/ownerGroup.graphql'
import type { userQuery as document7, UserQueryPayload as Payload7, UserQueryVariables as Variables7 } from '~tests/fixtures/documents/queries/user.graphql'
import type { userGroupsQuery as document8, UserGroupsQueryPayload as Payload8, UserGroupsQueryVariables as Variables8 } from '~tests/fixtures/documents/queries/userGroups.graphql'
import type { usersQuery as document9, UsersQueryPayload as Payload9, UsersQueryVariables as Variables9 } from '~tests/fixtures/documents/queries/users.graphql'
import type { ownerGroupChangedSubscription as document10, OwnerGroupChangedSubscriptionPayload as Payload10, OwnerGroupChangedSubscriptionVariables as Variables10 } from '~tests/fixtures/documents/subscriptions/ownerGroupChanged.graphql'
import type { userCreatedSubscription as document11, UserCreatedSubscriptionPayload as Payload11, UserCreatedSubscriptionVariables as Variables11 } from '~tests/fixtures/documents/subscriptions/userCreated.graphql'

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
    expectTypeOf<ResultOf<typeof document5>>().toEqualTypeOf<Payload5>()
    expectTypeOf<VariablesOf<typeof document5>>().toEqualTypeOf<Variables5>()
    expectTypeOf<ResultOf<typeof document6>>().toEqualTypeOf<Payload6>()
    expectTypeOf<VariablesOf<typeof document6>>().toEqualTypeOf<Variables6>()
    expectTypeOf<ResultOf<typeof document7>>().toEqualTypeOf<Payload7>()
    expectTypeOf<VariablesOf<typeof document7>>().toEqualTypeOf<Variables7>()
    expectTypeOf<ResultOf<typeof document8>>().toEqualTypeOf<Payload8>()
    expectTypeOf<VariablesOf<typeof document8>>().toEqualTypeOf<Variables8>()
    expectTypeOf<ResultOf<typeof document9>>().toEqualTypeOf<Payload9>()
    expectTypeOf<VariablesOf<typeof document9>>().toEqualTypeOf<Variables9>()
    expectTypeOf<ResultOf<typeof document10>>().toEqualTypeOf<Payload10>()
    expectTypeOf<VariablesOf<typeof document10>>().toEqualTypeOf<Variables10>()
    expectTypeOf<ResultOf<typeof document11>>().toEqualTypeOf<Payload11>()
    expectTypeOf<VariablesOf<typeof document11>>().toEqualTypeOf<Variables11>()
})
