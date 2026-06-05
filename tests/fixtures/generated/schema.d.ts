import type { Permission } from './enums'

export type Scalars = {
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
	Boolean: { input: boolean; output: boolean; };
	DateTime: { input: string; output: string; };
}

export type AddGroupInput = {
	createdBy: string;
	name: string;
}

export type ChangeOwnerInput = {
	id: string;
}

export type CreateUserInput = {
	firstName?: string | null;
	lastName?: string | null;
	name: string;
	username: string;
}

export type UsersFilter = {
	isOnline: boolean;
}

export type Group = {
	createdAt: string;
	createdBy: User;
	id: string;
	name: string;
	owner: User;
}

export type User = {
	firstName?: string | null;
	groups: Array<Group>;
	id: string;
	isOnline: boolean;
	lastName?: string | null;
	permissions: Array<Permission>;
	username: string;
}

export type Mutation = {
	__typename?: 'Mutation';
	addGroup: Group;
	changeOwner: User;
	createUser: User;
	removeGroup: RemoveGroupPayload;
}

export type OwnerGroupChangedPayload = Group & {
	__typename?: 'OwnerGroupChangedPayload';
	changedAt: string;
	createdAt: string;
	createdBy: User;
	id: string;
	name: string;
	owner: User;
}

export type Query = {
	__typename?: 'Query';
	groupMembers: Array<User>;
	ownerGroup?: User | null;
	user?: User | null;
	userGroups: Array<Group>;
	users: Array<User>;
}

export type RemoveGroupPayload = {
	__typename?: 'RemoveGroupPayload';
	id: string;
}

export type Subscription = {
	__typename?: 'Subscription';
	ownerGroupChanged: OwnerGroupChangedPayload;
	userCreated: UserCreatedPayload;
}

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

export type QueryGroupMembersArgs = {
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

export type SubscriptionOwnerGroupChangedArgs = {
	groupId: string;
}