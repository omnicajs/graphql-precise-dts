import type { Status } from '@app/graphql/enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	/**
	 * ISO date-time string. Do not close *\/ generated documentation.
	 * @see https://scalars.graphql.org/andimarek/date-time.html
	 */
	DateTime: { input: string; output: string; };
	ID: { input: string; output: string; };
	Int: { input: number; output: number; };
	String: { input: string; output: string; };
}

/** A globally identifiable result. */
export type Node = {
	__typename?: 'Team' | 'User';
	/** Stable result identifier. */
	id: string;
}

export type Orphan = {
	__typename?: string;
	code?: string | null;
}

/**
 * Search entrypoint.
 *
 * The blank description line is preserved.
 */
export type Query = {
	__typename?: 'Query';
	/** Find matching resources. */
	search: Array<SearchResult>;
}

export type QuerySearchArgs = {
	/** Optional result discriminator. */
	filter?: SearchFilter | null;
	/**
	 * Maximum number of results.
	 * @deprecated The server now chooses the limit.
	 */
	limit?: number | null;
	/** Optional numeric boundaries. */
	range?: Range | null;
}

/** Numeric search boundaries. */
export type Range = {
	/** Inclusive lower boundary. */
	from: number;
	/**
	 * Inclusive upper boundary.
	 * @deprecated Use an open-ended range instead.
	 */
	to?: number | null;
}

export type Resource = Node & {
	__typename?: 'User';
	id: string;
}

/** Exactly one search discriminator. */
export type SearchFilter = {
	/** Status search. */
	status: Status;
	term?: never;
} | {
	status?: never;
	/** Free-text search. */
	term: string;
}

/** A result returned by search. */
export type SearchResult = Team | User

export type Team = Node & {
	__typename?: 'Team';
	id: string;
	title: string;
}

/** A person returned by search. */
export type User = Node & Resource & {
	__typename?: 'User';
	createdAt: string;
	id: string;
	name: string;
	/** @deprecated */
	nickname?: string | null;
	status: Status;
}
