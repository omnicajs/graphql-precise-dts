export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Base = {
	__typename?: string;
	id: string;
}

export type Query = {
	__typename?: 'Query';
	item: Specialized;
}

export type Specialized = Base & {
	__typename?: string;
	id: string;
	label: string;
}
