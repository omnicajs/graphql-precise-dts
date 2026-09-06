export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	Date: { input: unknown; output: unknown; };
	String: { input: string; output: string; };
}

export type Query = {
	__typename?: 'Query';
	viewer: string;
}
