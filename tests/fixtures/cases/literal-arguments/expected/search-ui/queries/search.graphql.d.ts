declare module 'queries/search.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type SearchQueryVariables = { [key: string]: never }

	export type SearchQueryPayload = {
		__typename?: 'Query';
		search: Array<{
			__typename?: 'SearchResult';
			id: string;
		}>;
	}

	export const searchQuery: TypedDocumentNode<SearchQueryPayload, SearchQueryVariables>

	export default searchQuery
}
