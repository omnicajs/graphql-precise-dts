import type { ApolloClient } from '@apollo/client'

import type { GroupDetails as GroupDetailsFragment } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'
import type { UserDetails as UserDetailsFragment } from '~tests/fixtures/documents/fragments/UserDetails.graphql'
import type { UserWithGroups as UserWithGroupsFragment } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

import type {
    GroupMembersQuery,
    GroupMembersQueryVariables,
} from '~tests/fixtures/documents/queries/groupMembers.graphql'
import type {
    OwnerGroupQuery,
    OwnerGroupQueryVariables,
} from '~tests/fixtures/documents/queries/ownerGroup.graphql'
import type {
    UserQuery,
    UserQueryVariables,
} from '~tests/fixtures/documents/queries/user.graphql'
import type {
    UserGroupsQuery,
    UserGroupsQueryVariables,
} from '~tests/fixtures/documents/queries/userGroups.graphql'
import type {
    UsersQuery,
    UsersQueryVariables,
} from '~tests/fixtures/documents/queries/users.graphql'

import type {
    AddGroupMutation,
    AddGroupMutationVariables,
} from '~tests/fixtures/documents/mutations/addGroup.graphql'
import type {
    ChangeOwnerMutation,
    ChangeOwnerMutationVariables,
} from '~tests/fixtures/documents/mutations/changeOwner.graphql'
import type {
    CreateUserMutation,
    CreateUserMutationVariables,
} from '~tests/fixtures/documents/mutations/createUser.graphql'
import type {
    RemoveGroupMutation,
    RemoveGroupMutationVariables,
} from '~tests/fixtures/documents/mutations/removeGroup.graphql'

import type {
    OwnerGroupChangedSubscription,
    OwnerGroupChangedSubscriptionVariables,
} from '~tests/fixtures/documents/subscriptions/ownerGroupChanged.graphql'
import type {
    UserCreatedSubscription,
    UserCreatedSubscriptionVariables,
} from '~tests/fixtures/documents/subscriptions/userCreated.graphql'

import type { Permission } from '../fixtures/artifacts/schema'

import {
    describe,
    expectTypeOf,
    test,
} from 'vitest'

import { groupMembersQuery } from '~tests/fixtures/documents/queries/groupMembers.graphql'
import { ownerGroupQuery } from '~tests/fixtures/documents/queries/ownerGroup.graphql'
import { userQuery } from '~tests/fixtures/documents/queries/user.graphql'
import { userGroupsQuery } from '~tests/fixtures/documents/queries/userGroups.graphql'
import { usersQuery } from '~tests/fixtures/documents/queries/users.graphql'

import { addGroupMutation } from '~tests/fixtures/documents/mutations/addGroup.graphql'
import { changeOwnerMutation } from '~tests/fixtures/documents/mutations/changeOwner.graphql'
import { createUserMutation } from '~tests/fixtures/documents/mutations/createUser.graphql'
import { removeGroupMutation } from '~tests/fixtures/documents/mutations/removeGroup.graphql'

import { ownerGroupChangedSubscription } from '~tests/fixtures/documents/subscriptions/ownerGroupChanged.graphql'
import { userCreatedSubscription } from '~tests/fixtures/documents/subscriptions/userCreated.graphql'

declare const client: ApolloClient

type Element<T> = T extends readonly (infer U)[] ? U : never
type Assert<T extends true> = T
type IsAssignable<From, To> = [From] extends [To] ? true : false
declare const __typeAssertions: unique symbol

describe('fragments', () => {
    describe('UserDetails', () => {
        test('signature match', () => {
            expectTypeOf<UserDetailsFragment>().toEqualTypeOf<{
                __typename?: 'UserCreatedPayload';
                id: string;
                username: string;
                firstName: string | null;
                lastName: string | null;
                isOnline: boolean;
            }>()
        })

        test('compatible with query result', async () => {
            const { data } = await client.query({
                query: groupMembersQuery,
                variables: { groudId: '1' },
            })

            data!.groupMembers!.map(gm => {
                expectTypeOf(gm).toEqualTypeOf<UserDetailsFragment>()
            })
        })
    })

    describe('GroupDetails', () => {
        test('signature match', () => {
            type OwnerPermissions = GroupDetailsFragment['owner']['permissions']
            type ExpectedOwnerPermissions = Array<Permission>
            type OwnerPermissionsExtendsExpected = Assert<
                IsAssignable<OwnerPermissions, ExpectedOwnerPermissions>
            >
            type ExpectedPermissionsExtendsOwner = Assert<
                IsAssignable<ExpectedOwnerPermissions, OwnerPermissions>
            >
            void (0 as unknown as {
                [__typeAssertions]: [
                    OwnerPermissionsExtendsExpected,
                    ExpectedPermissionsExtendsOwner,
                ];
            })

            expectTypeOf<GroupDetailsFragment>().toMatchObjectType<{
                __typename?: 'OwnerGroupChangedPayload';
                id: string;
                name: string;
                createdBy: UserDetailsFragment;
                createdAt: string;
            }>()

            expectTypeOf<GroupDetailsFragment['owner']>().toMatchObjectType<UserDetailsFragment>()
        })

        test('compatible with query result', async () => {
            const { data } = await client.query({
                query: userGroupsQuery,
                variables: { id: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<UserGroupsQuery>()
            data!.userGroups!.map(g => {
                expectTypeOf(g).toEqualTypeOf<GroupDetailsFragment>()

                expectTypeOf(g.owner).toMatchObjectType<UserDetailsFragment>()
                expectTypeOf(g.createdBy).toMatchObjectType<UserDetailsFragment>()
            })
        })

        test('fragment fields correspond to the signatures of nested fragments', () => {
            expectTypeOf<GroupDetailsFragment['owner']>().toMatchObjectType<UserDetailsFragment>()
            expectTypeOf<GroupDetailsFragment['createdBy']>().toMatchObjectType<UserDetailsFragment>()
        })
    })

    describe('UserWithGroupsDetails', () => {
        test('signature match', () => {
            expectTypeOf<UserWithGroupsFragment>().toEqualTypeOf<UserDetailsFragment & {
                groups: Array<GroupDetailsFragment>
            }>()
        })

        test('compatible with query result', async () => {
            const { data } = await client.query({
                query: userQuery,
                variables: { id: '1' },
            })

            expectTypeOf(data!.user!).toEqualTypeOf<UserWithGroupsFragment>()
        })

        test('fragment fields correspond to the signatures of nested fragments', () => {
            expectTypeOf<UserWithGroupsFragment>().toMatchObjectType<UserDetailsFragment>()
            expectTypeOf<Element<UserWithGroupsFragment['groups']>>().toEqualTypeOf<GroupDetailsFragment>()
        })
    })
})

describe('queries', () => {
    describe('get the owner of a group', () => {
        test('result', async () => {
            const { data } = await client.query({
                query: ownerGroupQuery,
                variables: { id: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<OwnerGroupQuery>()
        })

        test('variables', () => {
            expectTypeOf<OwnerGroupQueryVariables>().toEqualTypeOf<{
                id: string
            }>()
        })
    })

    describe('get user', () => {
        test('result', async () => {
            const { data } = await client.query({
                query: userQuery,
                variables: { id: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<UserQuery>()
        })

        test('variables', () => {
            expectTypeOf<UserQueryVariables>().toEqualTypeOf<{
                id: string
            }>()
        })
    })

    describe('get users', () => {
        test.each([
            { filter: { isOnline: true } },
            { filter: null },
        ])('result', async (variables) => {
            const { data } = await client.query({
                query: usersQuery,
                variables,
            })

            expectTypeOf(data!).toEqualTypeOf<UsersQuery>()
        })

        test('variables', () => {
            expectTypeOf<UsersQueryVariables>().toEqualTypeOf<{
                filter?: { isOnline: boolean } | null
            }>()
        })
    })

    describe('get user groups', () => {
        test('result', async () => {
            const { data } = await client.query({
                query: userGroupsQuery,
                variables: { id: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<UserGroupsQuery>()
        })

        test('variables', () => {
            expectTypeOf<UserGroupsQueryVariables>().toEqualTypeOf<{
                id: string
            }>()
        })
    })

    describe('get group members', () => {
        test('result', async () => {
            const { data } = await client.query({
                query: groupMembersQuery,
                variables: { groudId: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<GroupMembersQuery>()
        })

        test('variables', () => {
            expectTypeOf<GroupMembersQueryVariables>().toEqualTypeOf<{
                groudId: string
            }>()
        })
    })
})

describe('mutations', () => {
    describe('adding a new group', () => {
        test('result', async () => {
            const { data } = await client.mutate({
                mutation: addGroupMutation,
                variables: {
                    input: {
                        name: 'test group',
                        createdBy: '1',
                    },
                },
            })

            expectTypeOf(data!).toEqualTypeOf<AddGroupMutation>()
        })

        test('variables', () => {
            expectTypeOf<AddGroupMutationVariables>().toEqualTypeOf<{
                input: {
                    name: string,
                    createdBy: string,
                }
            }>()
        })
    })

    describe('change group owner', () => {
        test('result', async () => {
            const { data } = await client.mutate({
                mutation: changeOwnerMutation,
                variables: {
                    input: {
                        id: '2',
                    },
                },
            })

            expectTypeOf(data!).toEqualTypeOf<ChangeOwnerMutation>()
        })

        test('variables', () => {
            expectTypeOf<ChangeOwnerMutationVariables>().toEqualTypeOf<{
                input: {
                    id: string
                }
            }>()
        })
    })

    describe('user creation', () => {
        test.each([
            { name: 'user1', username: 'user1', firstName: null, lastName: null },
            { name: 'user1', username: 'user1', firstName: 'firstName', lastName: null },
            { name: 'user1', username: 'user1', firstName: 'firstName', lastName: 'lastName' },
        ])('result', async (variables) => {
            const { data } = await client.mutate({
                mutation: createUserMutation,
                variables: {
                    input: { ...variables },
                },
            })

            expectTypeOf(data!).toEqualTypeOf<CreateUserMutation>()
        })

        test('variables', () => {
            expectTypeOf<CreateUserMutationVariables>().toEqualTypeOf<{
                input: {
                    name: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                }
            }>()
        })
    })

    describe('deleting a group', () => {
        test('result', async () => {
            const { data } = await client.mutate({
                mutation: removeGroupMutation,
                variables: { id: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<RemoveGroupMutation>()
        })

        test('variables', () => {
            expectTypeOf<RemoveGroupMutationVariables>().toEqualTypeOf<{
                id: string
            }>()
        })
    })
})

describe('subscriptions', () => {
    describe('change group owner', () => {
        test('result', async () => {
            const observable = client.subscribe({
                query: ownerGroupChangedSubscription,
                variables: { groupId: '1' },
            })

            observable.subscribe(({ data }) => {
                expectTypeOf(data!).toEqualTypeOf<OwnerGroupChangedSubscription>()
            })
        })

        test('variables', () => {
            expectTypeOf<OwnerGroupChangedSubscriptionVariables>().toEqualTypeOf<{
                groupId: string
            }>()
        })
    })

    describe('changing user data', () => {
        test('result', async () => {
            const observable = client.subscribe({
                query: userCreatedSubscription,
            })

            observable.subscribe(({ data }) => {
                expectTypeOf(data!).toEqualTypeOf<UserCreatedSubscription>()
            })
        })

        test('variables', () => {
            expectTypeOf<UserCreatedSubscriptionVariables>().toEqualTypeOf<{
                [key: string]: never
            }>()
        })
    })
})
