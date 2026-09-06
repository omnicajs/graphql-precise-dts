import type { SearchMode } from '@search/graphql/enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Query = {
	__typename?: 'Query';
	search: boolean;
}

export type QuerySearchArgs = {
	options: SearchOptions;
}

export type RecursiveFilter = {
	label?: string | null;
	nested?: RecursiveFilter | null;
}

export type SearchChoice = {
	id: string;
	mode?: never;
} | {
	id?: never;
	mode: SearchMode;
}

export type SearchOptions = {
	choice?: SearchChoice | null;
	filter?: RecursiveFilter | null;
	tags?: Array<string> | null;
}
