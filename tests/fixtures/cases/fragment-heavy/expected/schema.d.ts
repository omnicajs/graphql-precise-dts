export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Group = Node & {
	__typename?: 'Group';
	id: string;
	members: Array<User>;
	name: string;
	owner: User;
}

export type Node = {
	__typename?: 'Group' | 'User';
	id: string;
}

export type Query = {
	__typename?: 'Query';
	groups: Array<Group>;
	users: Array<User>;
}

export type User = Node & {
	__typename?: 'User';
	groups: Array<Group>;
	id: string;
	name: string;
}
