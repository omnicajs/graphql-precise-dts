export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	Int: { input: number; output: number; };
	String: { input: string; output: string; };
}

export enum Status {
	ACTIVE = 'ACTIVE',
	PAUSED = 'PAUSED',
}

export type Query = {
	__typename?: 'Query';
	search: Array<SearchResult>;
}

export type QuerySearchArgs = {
	filter: SearchFilter;
	limit?: number | null;
}

export type Range = {
	max?: number | null;
	min: number;
}

export type SearchFilter = {
	enabled?: boolean | null;
	query: string;
	range?: Range | null;
	statuses: Array<Status>;
}

export type SearchResult = {
	__typename?: 'SearchResult';
	id: string;
}
