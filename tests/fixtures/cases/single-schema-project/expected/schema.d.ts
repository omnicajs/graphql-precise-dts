import type { Permission } from '@case/enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	/**
	 * ISO date-time string.
	 * @see https://scalars.graphql.org/andimarek/date-time.html
	 */
	DateTime: { input: string; output: string; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

/** Input for creating a group. */
export type AddGroupInput = {
	/** Identifier of the user creating the group. */
	createdBy: string;
	/** Human-readable group name. */
	name: string;
}

/** Input for changing a group owner. */
export type ChangeOwnerInput = {
	/** Identifier of the new owner. */
	id: string;
}

/** Input for creating a user. */
export type CreateUserInput = {
	/** Optional first name. */
	firstName?: string | null;
	/** Optional last name. */
	lastName?: string | null;
	/** Display name. */
	name: string;
	/** Unique username. */
	username: string;
}

/** Common group fields. */
export type Group = {
	__typename?: 'OwnerGroupChangedPayload';
	/** Date when the group was created. */
	createdAt: string;
	/** User that created the group. */
	createdBy: User;
	/** Stable group identifier. */
	id: string;
	/** Human-readable group name. */
	name: string;
	/** User that owns the group. */
	owner: User;
}

/** Root write operations. */
export type Mutation = {
	__typename?: 'Mutation';
	/** Creates a group. */
	addGroup: Group;
	/** Changes the owner of a group. */
	changeOwner: User;
	/** Creates a user. */
	createUser: User;
	/** Removes a group by identifier. */
	removeGroup: RemoveGroupPayload;
}

export type MutationAddGroupArgs = {
	input: AddGroupInput;
}

export type MutationChangeOwnerArgs = {
	input: ChangeOwnerInput;
}

export type MutationCreateUserArgs = {
	input: CreateUserInput;
}

export type MutationRemoveGroupArgs = {
	id: string;
}

/** Payload emitted when a group owner changes. */
export type OwnerGroupChangedPayload = Group & {
	__typename?: 'OwnerGroupChangedPayload';
	/** Date when the owner was changed. */
	changedAt: string;
	createdAt: string;
	createdBy: User;
	id: string;
	name: string;
	owner: User;
}

/** Root read operations. */
export type Query = {
	__typename?: 'Query';
	/** Lists users that belong to a group. */
	groupMembers: Array<User>;
	/** Finds the group owned by the selected user. */
	ownerGroup?: User | null;
	/** Finds a user by identifier. */
	user?: User | null;
	/** Lists groups for the selected user. */
	userGroups: Array<Group>;
	/** Lists users matching the provided filter. */
	users: Array<User>;
}

export type QueryGroupMembersArgs = {
	/** Target group identifier. */
	groudId: string;
}

export type QueryOwnerGroupArgs = {
	id: string;
}

export type QueryUserArgs = {
	id: string;
}

export type QueryUserGroupsArgs = {
	id: string;
}

export type QueryUsersArgs = {
	filter?: UsersFilter | null;
}

/** Payload returned after removing a group. */
export type RemoveGroupPayload = {
	__typename?: 'RemoveGroupPayload';
	/** Identifier of the removed group. */
	id: string;
}

/** Root realtime operations. */
export type Subscription = {
	__typename?: 'Subscription';
	/** Emitted when a group owner changes. */
	ownerGroupChanged: OwnerGroupChangedPayload;
	/** Emitted when a user is created. */
	userCreated: UserCreatedPayload;
}

export type SubscriptionOwnerGroupChangedArgs = {
	groupId: string;
}

/** Common user fields. */
export type User = {
	__typename?: 'UserCreatedPayload';
	/** Optional first name. */
	firstName?: string | null;
	/** Groups the user belongs to. */
	groups: Array<Group>;
	/** Stable user identifier. */
	id: string;
	/** Whether the user is currently online. */
	isOnline: boolean;
	/** Optional last name. */
	lastName?: string | null;
	/** Permissions granted to the user. */
	permissions: Array<Permission>;
	/** Unique username. */
	username: string;
}

/** Payload emitted when a user is created. */
export type UserCreatedPayload = User & {
	__typename?: 'UserCreatedPayload';
	createdAt: string;
	firstName?: string | null;
	groups: Array<Group>;
	id: string;
	isOnline: boolean;
	lastName?: string | null;
	permissions: Array<Permission>;
	username: string;
}

/** Filters used when listing users. */
export type UsersFilter = {
	/** Limits results to users with the selected online state. */
	isOnline: boolean;
}
