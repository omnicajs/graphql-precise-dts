type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

declare module '~tests/fixtures/documents/fragments/GroupDetails.graphql' {
    import type { Permission } from './schema'
    import type { UserDetails } from '~tests/fixtures/documents/fragments/UserDetails.graphql'

    export type GroupDetails = {
        __typename?: 'OwnerGroupChangedPayload';
        id: string;
        name: string;
        owner: {
            permissions: Array<Permission>;
        } & UserDetails;
        createdBy: UserDetails;
        createdAt: string;
    }
}

declare module '~tests/fixtures/documents/fragments/UserDetails.graphql' {
    export type UserDetails = {
        __typename?: 'UserCreatedPayload';
        id: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
        isOnline: boolean;
    }
}

declare module '~tests/fixtures/documents/fragments/UserWithGroups.graphql' {
    import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'
    import type { UserDetails } from '~tests/fixtures/documents/fragments/UserDetails.graphql'

    export type UserWithGroups = {
        groups: Array<GroupDetails>;
    } & UserDetails
}

declare module '~tests/fixtures/documents/mutations/addGroup.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'

    export type AddGroupMutation = {
        __typename?: 'Mutation';
        addGroup: GroupDetails;
    }

    export type AddGroupMutationVariables = Exact<{
        input: {
            createdBy: string;
            name: string;
        };
    }>

    export const addGroupMutation: TypedDocumentNode<AddGroupMutation, AddGroupMutationVariables>

    export default addGroupMutation
}

declare module '~tests/fixtures/documents/mutations/changeOwner.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

    export type ChangeOwnerMutation = {
        __typename?: 'Mutation';
        changeOwner: UserWithGroups;
    }

    export type ChangeOwnerMutationVariables = Exact<{
        input: {
            id: string;
        };
    }>

    export const changeOwnerMutation: TypedDocumentNode<ChangeOwnerMutation, ChangeOwnerMutationVariables>

    export default changeOwnerMutation
}

declare module '~tests/fixtures/documents/mutations/createUser.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

    export type CreateUserMutation = {
        __typename?: 'Mutation';
        createUser: UserWithGroups;
    }

    export type CreateUserMutationVariables = Exact<{
        input: {
            firstName?: string | null;
            lastName?: string | null;
            name: string;
            username: string;
        };
    }>

    export const createUserMutation: TypedDocumentNode<CreateUserMutation, CreateUserMutationVariables>

    export default createUserMutation
}

declare module '~tests/fixtures/documents/mutations/removeGroup.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    export type RemoveGroupMutation = {
        __typename?: 'Mutation';
        removeGroup: {
            __typename?: 'RemoveGroupPayload';
            id: string;
        };
    }

    export type RemoveGroupMutationVariables = Exact<{
        id: string;
    }>

    export const removeGroupMutation: TypedDocumentNode<RemoveGroupMutation, RemoveGroupMutationVariables>

    export default removeGroupMutation
}

declare module '~tests/fixtures/documents/queries/groupMembers.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserDetails } from '~tests/fixtures/documents/fragments/UserDetails.graphql'

    export type GroupMembersQuery = {
        __typename?: 'Query';
        groupMembers: Array<UserDetails>;
    }

    export type GroupMembersQueryVariables = Exact<{
        groudId: string;
    }>

    export const groupMembersQuery: TypedDocumentNode<GroupMembersQuery, GroupMembersQueryVariables>

    export default groupMembersQuery
}

declare module '~tests/fixtures/documents/queries/ownerGroup.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

    export type OwnerGroupQuery = {
        __typename?: 'Query';
        ownerGroup: UserWithGroups | null;
    }

    export type OwnerGroupQueryVariables = Exact<{
        id: string;
    }>

    export const ownerGroupQuery: TypedDocumentNode<OwnerGroupQuery, OwnerGroupQueryVariables>

    export default ownerGroupQuery
}

declare module '~tests/fixtures/documents/queries/user.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

    export type UserQuery = {
        __typename?: 'Query';
        user: UserWithGroups | null;
    }

    export type UserQueryVariables = Exact<{
        id: string;
    }>

    export const userQuery: TypedDocumentNode<UserQuery, UserQueryVariables>

    export default userQuery
}

declare module '~tests/fixtures/documents/queries/userGroups.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'

    export type UserGroupsQuery = {
        __typename?: 'Query';
        userGroups: Array<GroupDetails>;
    }

    export type UserGroupsQueryVariables = Exact<{
        id: string;
    }>

    export const userGroupsQuery: TypedDocumentNode<UserGroupsQuery, UserGroupsQueryVariables>

    export default userGroupsQuery
}

declare module '~tests/fixtures/documents/queries/users.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

    export type UsersQuery = {
        __typename?: 'Query';
        users: Array<UserWithGroups>;
    }

    export type UsersQueryVariables = Exact<{
        filter?: {
            isOnline: boolean;
        } | null;
    }>

    export const usersQuery: TypedDocumentNode<UsersQuery, UsersQueryVariables>

    export default usersQuery
}

declare module '~tests/fixtures/documents/subscriptions/ownerGroupChanged.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'

    export type OwnerGroupChangedSubscription = {
        __typename?: 'Subscription';
        ownerGroupChanged: {
            changedAt: string;
        } & GroupDetails;
    }

    export type OwnerGroupChangedSubscriptionVariables = Exact<{
        groupId: string;
    }>

    export const ownerGroupChangedSubscription: TypedDocumentNode<OwnerGroupChangedSubscription, OwnerGroupChangedSubscriptionVariables>

    export default ownerGroupChangedSubscription
}

declare module '~tests/fixtures/documents/subscriptions/userCreated.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

    export type UserCreatedSubscription = {
        __typename?: 'Subscription';
        userCreated: {
            createdAt: string;
        } & UserWithGroups;
    }

    export type UserCreatedSubscriptionVariables = Exact<{ [key: string]: never }>

    export const userCreatedSubscription: TypedDocumentNode<UserCreatedSubscription, UserCreatedSubscriptionVariables>

    export default userCreatedSubscription
}