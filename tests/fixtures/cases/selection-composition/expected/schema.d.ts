export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Node = {
	__typename?: 'Team' | 'User';
	id: string;
}

export type Profile = {
	__typename?: 'Profile';
	displayName: string;
	nickname?: string | null;
}

export type Query = {
	__typename?: 'Query';
	node: Node;
}

export type QueryNodeArgs = {
	id: string;
}

export type Team = Node & {
	__typename?: 'Team';
	id: string;
	title: string;
}

export type User = Node & {
	__typename?: 'User';
	id: string;
	name: string;
	profile: Profile;
}
