import type { ReviewState } from '@app/graphql/enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Book = {
	__typename?: 'Book';
	id: string;
	state: ReviewState;
	title: string;
}

export type Query = {
	__typename?: 'Query';
	book: Book;
	remote: Remote;
}

export type QueryBookArgs = {
	id: string;
}

export type Remote = {
	__typename?: string;
	id: string;
	state: ReviewState;
}
