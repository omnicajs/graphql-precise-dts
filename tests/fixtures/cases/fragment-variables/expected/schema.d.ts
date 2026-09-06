export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Query = {
	__typename?: 'Query';
	user?: User | null;
}

export type QueryUserArgs = {
	id: string;
}

export type User = {
	__typename?: 'User';
	id: string;
	name: string;
}
