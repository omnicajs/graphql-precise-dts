import type { Permission } from './enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }
export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
	Boolean: { input: boolean; output: boolean; };
	/**
	 * ISO date-time string.
	 * @see https://scalars.graphql.org/andimarek/date-time.html
	 */
	DateTime: { input: string; output: string; };
}

/** Input for creating a group. */
export type AddGroupInput = {
	/**
	 * Identifier of the user creating the group.
	 * @remarks Scalar reference: `Scalars['ID']['input']`.
	 */
	createdBy: string;
	/**
	 * Human-readable group name.
	 * @remarks Scalar reference: `Scalars['String']['input']`.
	 */
	name: string;
}

/** Input for changing a group owner. */
export type ChangeOwnerInput = {
	/**
	 * Identifier of the new owner.
	 * @remarks Scalar reference: `Scalars['ID']['input']`.
	 */
	id: string;
}

/** Input for creating a user. */
export type CreateUserInput = {
	/**
	 * Optional first name.
	 * @remarks Scalar reference: `Scalars['String']['input']`.
	 */
	firstName?: string | null;
	/**
	 * Optional last name.
	 * @remarks Scalar reference: `Scalars['String']['input']`.
	 */
	lastName?: string | null;
	/**
	 * Display name.
	 * @remarks Scalar reference: `Scalars['String']['input']`.
	 */
	name: string;
	/**
	 * Unique username.
	 * @remarks Scalar reference: `Scalars['String']['input']`.
	 */
	username: string;
}

/** Filters used when listing users. */
export type UsersFilter = {
	/**
	 * Limits results to users with the selected online state.
	 * @remarks Scalar reference: `Scalars['Boolean']['input']`.
	 */
	isOnline: boolean;
}

/** Common group fields. */
export type Group = {
	/**
	 * Date when the group was created.
	 * @remarks Scalar reference: `Scalars['DateTime']['output']`.
	 */
	createdAt: string;
	/** User that created the group. */
	createdBy: User;
	/**
	 * Stable group identifier.
	 * @remarks Scalar reference: `Scalars['ID']['output']`.
	 */
	id: string;
	/**
	 * Human-readable group name.
	 * @remarks Scalar reference: `Scalars['String']['output']`.
	 */
	name: string;
	/** User that owns the group. */
	owner: User;
}

/** Common user fields. */
export type User = {
	/**
	 * Optional first name.
	 * @remarks Scalar reference: `Scalars['String']['output']`.
	 */
	firstName?: string | null;
	/** Groups the user belongs to. */
	groups: Array<Group>;
	/**
	 * Stable user identifier.
	 * @remarks Scalar reference: `Scalars['ID']['output']`.
	 */
	id: string;
	/**
	 * Whether the user is currently online.
	 * @remarks Scalar reference: `Scalars['Boolean']['output']`.
	 */
	isOnline: boolean;
	/**
	 * Optional last name.
	 * @remarks Scalar reference: `Scalars['String']['output']`.
	 */
	lastName?: string | null;
	/** Permissions granted to the user. */
	permissions: Array<Permission>;
	/**
	 * Unique username.
	 * @remarks Scalar reference: `Scalars['String']['output']`.
	 */
	username: string;
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

/** Payload emitted when a group owner changes. */
export type OwnerGroupChangedPayload = Group & {
	__typename?: 'OwnerGroupChangedPayload';
	/**
	 * Date when the owner was changed.
	 * @remarks Scalar reference: `Scalars['DateTime']['output']`.
	 */
	changedAt: string;
	/** @remarks Scalar reference: `Scalars['DateTime']['output']`. */
	createdAt: string;
	createdBy: User;
	/** @remarks Scalar reference: `Scalars['ID']['output']`. */
	id: string;
	/** @remarks Scalar reference: `Scalars['String']['output']`. */
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

/** Payload returned after removing a group. */
export type RemoveGroupPayload = {
	__typename?: 'RemoveGroupPayload';
	/**
	 * Identifier of the removed group.
	 * @remarks Scalar reference: `Scalars['ID']['output']`.
	 */
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

/** Payload emitted when a user is created. */
export type UserCreatedPayload = User & {
	__typename?: 'UserCreatedPayload';
	/** @remarks Scalar reference: `Scalars['DateTime']['output']`. */
	createdAt: string;
	/** @remarks Scalar reference: `Scalars['String']['output']`. */
	firstName?: string | null;
	groups: Array<Group>;
	/** @remarks Scalar reference: `Scalars['ID']['output']`. */
	id: string;
	/** @remarks Scalar reference: `Scalars['Boolean']['output']`. */
	isOnline: boolean;
	/** @remarks Scalar reference: `Scalars['String']['output']`. */
	lastName?: string | null;
	permissions: Array<Permission>;
	/** @remarks Scalar reference: `Scalars['String']['output']`. */
	username: string;
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
	/** @remarks Scalar reference: `Scalars['ID']['input']`. */
	id: string;
}

export type QueryGroupMembersArgs = {
	/**
	 * Target group identifier.
	 * @remarks Scalar reference: `Scalars['ID']['input']`.
	 */
	groudId: string;
}

export type QueryOwnerGroupArgs = {
	/** @remarks Scalar reference: `Scalars['ID']['input']`. */
	id: string;
}

export type QueryUserArgs = {
	/** @remarks Scalar reference: `Scalars['ID']['input']`. */
	id: string;
}

export type QueryUserGroupsArgs = {
	/** @remarks Scalar reference: `Scalars['ID']['input']`. */
	id: string;
}

export type QueryUsersArgs = {
	filter?: UsersFilter | null;
}

export type SubscriptionOwnerGroupChangedArgs = {
	/** @remarks Scalar reference: `Scalars['ID']['input']`. */
	groupId: string;
}