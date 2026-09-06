export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Query = {
	__typename?: 'Query';
	user: User;
}

export type QueryUserArgs = {
	id: string;
	locale?: string | null;
}

export type User = {
	__typename?: 'User';
	friend?: User | null;
	id: string;
	name: string;
	nickname?: string | null;
}
