type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }

declare module '~tests/__fixtures__/api/fragments/UserDetails.graphql' {
    export type UserDetails = {
        id: string;
        username: string;
        firstName?: string | null;
        lastName?: string | null;
        isOnline: boolean;
    }
}

declare module '~tests/__fixtures__/api/fragments/GroupDetails.graphql' {
    export type GroupDetails = {
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
    }
}

declare module '~tests/__fixtures__/api/fragments/UserWithGroups.graphql' {
    export type UserWithGroups = {
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
    }
}

declare module '~tests/__fixtures__/api/mutations/addGroup.graphql' {
    import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

    export type AddGroupMutation = {
        __typename?: 'Mutation',
        addGroup: {
            __typename?: 'OwnerGroupChangedPayload',
            id: string,
            name: string,
            createdAt: string,
            owner: {
                __typename?: 'UserCreatedPayload',
                id: string,
                username: string,
                firstName?: string | null,
                lastName?: string | null,
                isOnline: boolean
                permissions: Array<'GroupCreate' | 'GroupEdit'>,
            },
            createdBy: {
                __typename?: 'UserCreatedPayload',
                id: string,
                username: string,
                firstName?: string | null,
                lastName?: string | null,
                isOnline: boolean
            }
        }
    }

    export type AddGroupMutationVariables = Exact<{
        input: {
            createdBy: string,
            name: string
        }
    }>

    export const mutation: TypedDocumentNode<AddGroupMutation, AddGroupMutationVariables>

    export default mutation
}

declare module '~tests/__fixtures__/api/mutations/changeOwner.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type ChangeOwnerMutation = {
        __typename?: 'Mutation',
        changeOwner: {
            __typename?: 'UserCreatedPayload',
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean,
            groups: {
                __typename?: 'OwnerGroupChangedPayload',
                id: string,
                name: string,
                createdAt: string,
                owner: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                    permissions: Array<'GroupCreate' | 'GroupEdit'>,
                },
                createdBy: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                }
            }
        }
    }

    export type ChangeOwnerMutationVariables = Exact<{
        input: { id: string; }
    }>

    export const mutation: DocumentNode<ChangeOwnerMutation, ChangeOwnerMutationVariables>

    export default mutation
}

declare module '~tests/__fixtures__/api/mutations/createUser.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type CreateUserMutation = {
        __typename?: 'Mutation',
        createUser: {
            __typename?: 'UserCreatedPayload',
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean,
            groups: {
                __typename?: 'OwnerGroupChangedPayload',
                id: string,
                name: string,
                createdAt: string,
                owner: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                    permissions: Array<'GroupCreate' | 'GroupEdit'>,
                },
                createdBy: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                }
            }
        }
    }

    export type CreateUserMutationVariables = Exact<{
        input: {
            name: string
            username: string
            firstName?: string | null
            lastName?: string | null
        }
    }>

    export const mutation: DocumentNode<CreateUserMutation, CreateUserMutationVariables>

    export default mutation
}

declare module '~tests/__fixtures__/api/mutations/removeGroup.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type RemoveGroupMutation = {
        __typename?: 'Mutation',
        removeGroup: {
            __typename?: 'RemoveGroupPayload',
            id: string
        }
    }

    export type RemoveGroupMutationVariables = Exact<{
        id: string;
    }>

    export const mutation: DocumentNode<RemoveGroupMutation, RemoveGroupMutationVariables>

    export default mutation
}

declare module '~tests/__fixtures__/api/queries/user.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type UserQuery = {
        __typename?: 'Query',
        user?: {
            __typename?: 'UserCreatedPayload',
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean,
            groups: Array<{
                __typename?: 'OwnerGroupChangedPayload',
                id: string,
                name: string,
                createdAt: string,
                owner: {
                    __typename?: 'UserCreatedPayload',
                    permissions: Array<'GroupCreate' | 'GroupEdit'>,
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                },
                createdBy: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                }
            }>
        } | null
    }

    export type UserQueryVariables = Exact<{
        id: string;
    }>

    export const query: DocumentNode<UserQuery, UserQueryVariables>

    export default query
}

declare module '~tests/__fixtures__/api/queries/ownerGroup.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type OwnerGroupQuery = {
        __typename?: 'Query',
        ownerGroup: {
            __typename?: 'UserCreatedPayload',
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean,
            groups: {
                __typename?: 'OwnerGroupChangedPayload',
                id: string,
                name: string,
                createdAt: string,
                owner: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                    permissions: Array<'GroupCreate' | 'GroupEdit'>,
                },
                createdBy: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                }
            }
        } | null
    }

    export type OwnerGroupQueryVariables = Exact<{
        id: string;
    }>

    export const query: DocumentNode<OwnerGroupQuery, OwnerGroupQueryVariables>

    export default query
}

declare module '~tests/__fixtures__/api/queries/userGroups.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type UserGroupsQuery = {
        __typename?: 'Query',
        userGroups: Array<{
            __typename?: 'OwnerGroupChangedPayload',
            id: string,
            name: string,
            createdAt: string,
            owner: {
                __typename?: 'UserCreatedPayload',
                id: string,
                username: string,
                firstName?: string | null,
                lastName?: string | null,
                isOnline: boolean
                permissions: Array<'GroupCreate' | 'GroupEdit'>,
            },
            createdBy: {
                __typename?: 'UserCreatedPayload',
                id: string,
                username: string,
                firstName?: string | null,
                lastName?: string | null,
                isOnline: boolean
            }
        }>
    }

    export type UserGroupsQueryVariables = Exact<{
        id: string;
    }>

    export const query: DocumentNode<UserGroupsQuery, UserGroupsQueryVariables>

    export default query
}

declare module '~tests/__fixtures__/api/queries/users.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type UsersQuery = {
        __typename?: 'Query',
        users: Array<{
            __typename?: 'UserCreatedPayload',
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean,
            groups: Array<{
                __typename?: 'OwnerGroupChangedPayload',
                id: string,
                name: string,
                createdAt: string,
                owner: {
                    __typename?: 'UserCreatedPayload',
                    permissions: Array<'GroupCreate' | 'GroupEdit'>,
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                },
                createdBy: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                }
            }>
        }>
    }

    export type UsersQueryVariables = Exact<{
        filter?: { isOnline: boolean } | null
    }>

    export const query: DocumentNode<UsersQuery, UsersQueryVariables>

    export default query
}

declare module '~tests/__fixtures__/api/queries/groupMembers.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type GroupMembersQuery = {
        __typename?: 'Query',
        groupMembers: Array<{
            __typename?: 'UserCreatedPayload',
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean
        }>
    }

    export type GroupMembersQueryVariables = Exact<{ groudId: string }>

    export const query: DocumentNode<GroupMembersQuery, GroupMembersQueryVariables>

    export default query
}

declare module '~tests/__fixtures__/api/subscriptions/userCreated.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type UserCreatedSubscription = {
        __typename?: 'Subscription',
        userCreated: {
            __typename?: 'UserCreatedPayload',
            createdAt: string,
            id: string,
            username: string,
            firstName?: string | null,
            lastName?: string | null,
            isOnline: boolean,
            groups: Array<{
                __typename?: 'OwnerGroupChangedPayload',
                id: string,
                name: string,
                createdAt: string,
                owner: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                    permissions: Array<'GroupCreate' | 'GroupEdit'>,
                },
                createdBy: {
                    __typename?: 'UserCreatedPayload',
                    id: string,
                    username: string,
                    firstName?: string | null,
                    lastName?: string | null,
                    isOnline: boolean
                }
            }>
        }
    }

    export type UserCreatedSubscriptionVariables = Exact<{ [key: string]: never }>

    export const subscription: DocumentNode<UserCreatedSubscription, UserCreatedSubscriptionVariables>

    export default subscription
}

declare module '~tests/__fixtures__/api/subscriptions/ownerGroupChanged.graphql' {
    import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'

    export type OwnerGroupChangedSubscription = {
        __typename?: 'Subscription',
        ownerGroupChanged: {
            __typename?: 'OwnerGroupChangedPayload',
            id: string,
            name: string,
            createdAt: string,
            owner: {
                __typename?: 'UserCreatedPayload',
                id: string,
                username: string,
                firstName?: string | null,
                lastName?: string | null,
                isOnline: boolean
                permissions: Array<'GroupCreate' | 'GroupEdit'>,
            },
            createdBy: {
                __typename?: 'UserCreatedPayload',
                id: string,
                username: string,
                firstName?: string | null,
                lastName?: string | null,
                isOnline: boolean
            }
            changedAt: string
        }
    }

    export type OwnerGroupChangedSubscriptionVariables = Exact<{
        groupId: string;
    }>

    export const subscription: DocumentNode<OwnerGroupChangedSubscription, OwnerGroupChangedSubscriptionVariables>

    export default subscription
}
