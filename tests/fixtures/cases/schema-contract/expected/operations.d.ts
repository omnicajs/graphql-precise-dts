import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { Status } from '@app/graphql/enums'

export type SearchQueryVariables = Exact<{
	filter?: {
		status: Status;
		term?: never;
	} | {
		status?: never;
		term: string;
	} | null;
	range?: {
		from: number;
		to?: number | null;
	} | null;
}>

export type SearchQueryPayload = {
	__typename?: 'Query';
	search: Array<{
		__typename: 'Team';
		id: string;
		title: string;
	} | {
		__typename: 'User';
		id: string;
		name: string;
		status: Status;
		createdAt: string;
	}>;
}

export const searchQuery: TypedDocumentNode<SearchQueryPayload, SearchQueryVariables>

export default searchQuery
