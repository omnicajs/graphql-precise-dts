export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type A = Node & {
	__typename?: 'A';
	a: string;
	child: A;
	id: string;
}

export type B = Node & {
	__typename?: 'B';
	b: string;
	id: string;
}

export type Node = {
	__typename?: 'A' | 'B';
	id: string;
}

export type Query = {
	__typename?: 'Query';
	onlyA?: A | null;
}
