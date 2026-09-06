import type { Exact, RecursiveFilter } from '@search/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { SearchMode } from '@search/graphql/enums'

export type SearchQueryVariables = Exact<{
	label?: string | null;
	nested?: {
		label?: string | null;
		nested?: RecursiveFilter | null;
	} | null;
	choice?: {
		id: string;
		mode?: never;
	} | {
		id?: never;
		mode: SearchMode;
	} | null;
}>

export type SearchQueryPayload = {
	__typename?: 'Query';
	search: boolean;
}

export const searchQuery: TypedDocumentNode<SearchQueryPayload, SearchQueryVariables>

export default searchQuery
