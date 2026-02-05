import type { ApolloClient } from '@apollo/client'

import type { GroupDetails as GroupDetailsFragment } from '~tests/__fixtures__/api/fragments/GroupDetails.graphql'
import type { UserDetails as UserDetailsFragment } from '~tests/__fixtures__/api/fragments/UserDetails.graphql'
import type { UserWithGroups as UserWithGroupsFragment } from '~tests/__fixtures__/api/fragments/UserWithGroups.graphql'

import type {
    GroupMembersQuery,
    GroupMembersQueryVariables,
} from '~tests/__fixtures__/api/queries/groupMembers.graphql'
import type {
    OwnerGroupQuery,
    OwnerGroupQueryVariables,
} from '~tests/__fixtures__/api/queries/ownerGroup.graphql'
import type {
    UserQuery,
    UserQueryVariables,
} from '~tests/__fixtures__/api/queries/user.graphql'
import type {
    UserGroupsQuery,
    UserGroupsQueryVariables,
} from '~tests/__fixtures__/api/queries/userGroups.graphql'
import type {
    UsersQuery,
    UsersQueryVariables,
} from '~tests/__fixtures__/api/queries/users.graphql'

import type {
    AddGroupMutation,
    AddGroupMutationVariables,
} from '~tests/__fixtures__/api/mutations/addGroup.graphql'
import type {
    ChangeOwnerMutation,
    ChangeOwnerMutationVariables,
} from '~tests/__fixtures__/api/mutations/changeOwner.graphql'
import type {
    CreateUserMutation,
    CreateUserMutationVariables
} from '~tests/__fixtures__/api/mutations/createUser.graphql'
import type {
    RemoveGroupMutation,
    RemoveGroupMutationVariables,
} from '~tests/__fixtures__/api/mutations/removeGroup.graphql'

import type {
    OwnerGroupChangedSubscription,
    OwnerGroupChangedSubscriptionVariables,
} from '~tests/__fixtures__/api/subscriptions/ownerGroupChanged.graphql'
import type {
    UserCreatedSubscription,
    UserCreatedSubscriptionVariables,
} from '~tests/__fixtures__/api/subscriptions/userCreated.graphql'

import {
    describe,
    expectTypeOf,
    test,
} from 'vitest'

import { query as GroupMembersDocument } from '~tests/__fixtures__/api/queries/groupMembers.graphql'
import { query as OwnerGroupDocument } from '~tests/__fixtures__/api/queries/ownerGroup.graphql'
import { query as UserDocument } from '~tests/__fixtures__/api/queries/user.graphql'
import { query as UserGroupsDocument } from '~tests/__fixtures__/api/queries/userGroups.graphql'
import { query as UsersDocument } from '~tests/__fixtures__/api/queries/users.graphql'

import { mutation as AddGroupDocument } from '~tests/__fixtures__/api/mutations/addGroup.graphql'
import { mutation as ChangeOwnerDocument } from '~tests/__fixtures__/api/mutations/changeOwner.graphql'
import { mutation as CreateUserDocument } from '~tests/__fixtures__/api/mutations/createUser.graphql'
import { mutation as RemoveGroupDocument } from '~tests/__fixtures__/api/mutations/removeGroup.graphql'

import { subscription as OwnerGroupChangedDocument } from '~tests/__fixtures__/api/subscriptions/ownerGroupChanged.graphql'
import { subscription as UserCreatedDocument } from '~tests/__fixtures__/api/subscriptions/userCreated.graphql'

declare const client: ApolloClient

type Element<T> = T extends readonly (infer U)[] ? U : never

describe('fragments', () => {
    describe('UserDetails', () => {
        test('signature match', () => {
            expectTypeOf<UserDetailsFragment>().toEqualTypeOf<{
                id: string;
                username: string;
                firstName?: string | null;
                lastName?: string | null;
                isOnline: boolean;
            }>()
        })

        test('compatible with query result', async () => {
            const { data } = await client.query({
                query: GroupMembersDocument,
                variables: { groudId: '1' },
            })

            data!.groupMembers!.map(gm => {
                expectTypeOf(gm).toMatchObjectType<UserDetailsFragment>()
            })
        })
    })

    describe('GroupDetails', () => {
        test('signature match', () => {
            expectTypeOf<GroupDetailsFragment>().toEqualTypeOf<{
                id: string;
                name: string;
                owner: {
                    id: string;
                    username: string;
                    firstName?: string | null;
                    lastName?: string | null;
                    isOnline: boolean;
                    permissions: Array<'GroupCreate' | 'GroupEdit'>;
                }
                createdBy: {
                    id: string;
                    username: string;
                    firstName?: string | null;
                    lastName?: string | null;
                    isOnline: boolean;
                }
                createdAt: string
            }>()
        })

        test('compatible with query result', async () => {
            const { data } = await client.query({
                query: UserGroupsDocument,
                variables: { id: '1' },
            })

            expectTypeOf(data!).toEqualTypeOf<UserGroupsQuery>()
            data!.userGroups!.map(g => {
                expectTypeOf(g).toMatchObjectType<GroupDetailsFragment>()

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
            expectTypeOf<UserWithGroupsFragment>().toEqualTypeOf<{
                id: string;
                username: string;
                firstName?: string | null;
                lastName?: string | null;
                isOnline: boolean;
                groups: Array<{
                    id: string;
                    name: string;
                    owner: {
                        id: string;
                        username: string;
                        firstName?: string | null;
                        lastName?: string | null;
                        isOnline: boolean;
                        permissions: Array<'GroupCreate' | 'GroupEdit'>;
                    }
                    createdBy: {
                        id: string;
                        username: string;
                        firstName?: string | null;
                        lastName?: string | null;
                        isOnline: boolean;
                    }
                    createdAt: string
                }>
            }>()
        })

        test('compatible with query result', async () => {
            const { data } = await client.query({
                query: UserDocument,
                variables: { id: '1' },
            })

            expectTypeOf(data!.user!).toMatchObjectType<Omit<UserWithGroupsFragment, 'groups'>>()
            data!.user!.groups.map(g => expectTypeOf(g).toMatchObjectType<GroupDetailsFragment>())
        })

        test('fragment fields correspond to the signatures of nested fragments', () => {
            expectTypeOf<UserWithGroupsFragment>().toMatchObjectType<UserDetailsFragment>()
            expectTypeOf<Element<UserWithGroupsFragment['groups']>>().toMatchObjectType<GroupDetailsFragment>()
        })
    })
})

describe('queries', () => {
    describe('get the owner of a group', () => {
        test('result', async () => {
            const { data } = await client.query({
                query: OwnerGroupDocument,
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
                query: UserDocument,
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
            undefined
        ])('result', async (variables) => {
            const { data } = await client.query({
                query: UsersDocument,
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
                query: UserGroupsDocument,
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
                query: GroupMembersDocument,
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
                mutation: AddGroupDocument,
                variables: {
                    input: {
                        name: 'test group',
                        createdBy: '1',
                    }
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
                mutation: ChangeOwnerDocument,
                variables: {
                    input: {
                        id: '2'
                    }
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
            { name: 'user1', username: 'user1' },
            { name: 'user1', username: 'user1', firstName: 'firstName' },
            { name: 'user1', username: 'user1', firstName: 'firstName', lastName: 'lastName' },
        ])('result', async (variables) => {
            const { data } = await client.mutate({
                mutation: CreateUserDocument,
                variables: {
                    input: { ...variables }
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
                mutation: RemoveGroupDocument,
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
                query: OwnerGroupChangedDocument,
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
                query: UserCreatedDocument,
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
