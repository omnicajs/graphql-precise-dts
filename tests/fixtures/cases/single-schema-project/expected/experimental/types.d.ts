declare module '~tests/fixtures/documents/fragments/GroupDetails.graphql' {
	import type { Permission } from './enums'

	import type { UserDetails } from '~tests/fixtures/documents/fragments/UserDetails.graphql'

	export type GroupDetails = {
		__typename?: 'OwnerGroupChangedPayload';
		id: string;
		name: string;
		owner: {
			__typename?: 'UserCreatedPayload';
			permissions: Array<Permission>;
		} & UserDetails;
		createdBy: {
			__typename?: 'UserCreatedPayload';
		} & UserDetails;
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
		__typename?: 'UserCreatedPayload';
		groups: Array<{
			__typename?: 'OwnerGroupChangedPayload';
		} & GroupDetails>;
	} & UserDetails
}

declare module '~tests/fixtures/documents/mutations/addGroup.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'

	export type AddGroupMutationVariables = Exact<{
		input: {
			createdBy: string;
			name: string;
		};
	}>

	export type AddGroupMutationPayload = {
		__typename?: 'Mutation';
		addGroup: {
			__typename?: 'OwnerGroupChangedPayload';
		} & GroupDetails;
	}

	export const addGroupMutation: TypedDocumentNode<AddGroupMutationPayload, AddGroupMutationVariables>

	export default addGroupMutation
}

declare module '~tests/fixtures/documents/mutations/changeOwner.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

	export type ChangeOwnerMutationVariables = Exact<{
		input: {
			id: string;
		};
	}>

	export type ChangeOwnerMutationPayload = {
		__typename?: 'Mutation';
		changeOwner: {
			__typename?: 'UserCreatedPayload';
		} & UserWithGroups;
	}

	export const changeOwnerMutation: TypedDocumentNode<ChangeOwnerMutationPayload, ChangeOwnerMutationVariables>

	export default changeOwnerMutation
}

declare module '~tests/fixtures/documents/mutations/createUser.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

	export type CreateUserMutationVariables = Exact<{
		input: {
			firstName?: string | null;
			lastName?: string | null;
			name: string;
			username: string;
		};
	}>

	export type CreateUserMutationPayload = {
		__typename?: 'Mutation';
		createUser: {
			__typename?: 'UserCreatedPayload';
		} & UserWithGroups;
	}

	export const createUserMutation: TypedDocumentNode<CreateUserMutationPayload, CreateUserMutationVariables>

	export default createUserMutation
}

declare module '~tests/fixtures/documents/mutations/removeGroup.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type RemoveGroupMutationVariables = Exact<{
		id: string;
	}>

	export type RemoveGroupMutationPayload = {
		__typename?: 'Mutation';
		removeGroup: {
			__typename?: 'RemoveGroupPayload';
			id: string;
		};
	}

	export const removeGroupMutation: TypedDocumentNode<RemoveGroupMutationPayload, RemoveGroupMutationVariables>

	export default removeGroupMutation
}

declare module '~tests/fixtures/documents/queries/groupMembers.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserDetails } from '~tests/fixtures/documents/fragments/UserDetails.graphql'

	export type GroupMembersQueryVariables = Exact<{
		groudId: string;
	}>

	export type GroupMembersQueryPayload = {
		__typename?: 'Query';
		groupMembers: Array<{
			__typename?: 'UserCreatedPayload';
		} & UserDetails>;
	}

	export const groupMembersQuery: TypedDocumentNode<GroupMembersQueryPayload, GroupMembersQueryVariables>

	export default groupMembersQuery
}

declare module '~tests/fixtures/documents/queries/ownerGroup.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

	export type OwnerGroupQueryVariables = Exact<{
		id: string;
	}>

	export type OwnerGroupQueryPayload = {
		__typename?: 'Query';
		ownerGroup: {
			__typename?: 'UserCreatedPayload';
		} & UserWithGroups | null;
	}

	export const ownerGroupQuery: TypedDocumentNode<OwnerGroupQueryPayload, OwnerGroupQueryVariables>

	export default ownerGroupQuery
}

declare module '~tests/fixtures/documents/queries/user.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

	export type UserQueryVariables = Exact<{
		id: string;
	}>

	export type UserQueryPayload = {
		__typename?: 'Query';
		user: {
			__typename?: 'UserCreatedPayload';
		} & UserWithGroups | null;
	}

	export const userQuery: TypedDocumentNode<UserQueryPayload, UserQueryVariables>

	export default userQuery
}

declare module '~tests/fixtures/documents/queries/userGroups.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'

	export type UserGroupsQueryVariables = Exact<{
		id: string;
	}>

	export type UserGroupsQueryPayload = {
		__typename?: 'Query';
		userGroups: Array<{
			__typename?: 'OwnerGroupChangedPayload';
		} & GroupDetails>;
	}

	export const userGroupsQuery: TypedDocumentNode<UserGroupsQueryPayload, UserGroupsQueryVariables>

	export default userGroupsQuery
}

declare module '~tests/fixtures/documents/queries/users.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

	export type UsersQueryVariables = Exact<{
		filter?: {
			isOnline: boolean;
		} | null;
	}>

	export type UsersQueryPayload = {
		__typename?: 'Query';
		users: Array<{
			__typename?: 'UserCreatedPayload';
		} & UserWithGroups>;
	}

	export const usersQuery: TypedDocumentNode<UsersQueryPayload, UsersQueryVariables>

	export default usersQuery
}

declare module '~tests/fixtures/documents/subscriptions/ownerGroupChanged.graphql' {
	import type { Exact } from './schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { GroupDetails } from '~tests/fixtures/documents/fragments/GroupDetails.graphql'

	export type OwnerGroupChangedSubscriptionVariables = Exact<{
		groupId: string;
	}>

	export type OwnerGroupChangedSubscriptionPayload = {
		__typename?: 'Subscription';
		ownerGroupChanged: {
			__typename?: 'OwnerGroupChangedPayload';
			changedAt: string;
		} & GroupDetails;
	}

	export const ownerGroupChangedSubscription: TypedDocumentNode<OwnerGroupChangedSubscriptionPayload, OwnerGroupChangedSubscriptionVariables>

	export default ownerGroupChangedSubscription
}

declare module '~tests/fixtures/documents/subscriptions/userCreated.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserWithGroups } from '~tests/fixtures/documents/fragments/UserWithGroups.graphql'

	export type UserCreatedSubscriptionVariables = { [key: string]: never }

	export type UserCreatedSubscriptionPayload = {
		__typename?: 'Subscription';
		userCreated: {
			__typename?: 'UserCreatedPayload';
			createdAt: string;
		} & UserWithGroups;
	}

	export const userCreatedSubscription: TypedDocumentNode<UserCreatedSubscriptionPayload, UserCreatedSubscriptionVariables>

	export default userCreatedSubscription
}
