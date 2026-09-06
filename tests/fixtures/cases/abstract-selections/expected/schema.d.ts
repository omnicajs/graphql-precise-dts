import type { SearchScope } from '@search/graphql/enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	/** @see https://example.test/date-time */
	DateTime: { input: string; output: string; };
	ID: { input: string; output: string; };
	Int: { input: number; output: number; };
	String: { input: string; output: string; };
}

export type Node = {
	__typename?: 'Team' | 'User';
	id: string;
	updatedAt: string;
}

export type Query = {
	__typename?: 'Query';
	node?: Node | null;
	search: Array<SearchResult>;
}

export type QueryNodeArgs = {
	id: string;
}

export type QuerySearchArgs = {
	archived?: boolean | null;
	filter: SearchFilter;
}

export type SearchFilter = {
	limit?: number | null;
	query: string;
	scope?: SearchScope | null;
	tags?: Array<string> | null;
	window?: SearchWindow | null;
}

export type SearchResult = Team | User

export type SearchWindow = {
	cursor?: string | null;
	limit?: number | null;
}

export type Team = Node & {
	__typename?: 'Team';
	id: string;
	title: string;
	updatedAt: string;
}

export type User = Node & {
	__typename?: 'User';
	id: string;
	name: string;
	updatedAt: string;
}
