declare module 'queries/search.graphql' {
	import type { Exact } from '@search/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { SearchScope } from '@search/graphql/enums'

	export type SearchQueryVariables = Exact<{
		filter: {
			limit?: number | null;
			query: string;
			scope?: SearchScope | null;
			tags?: Array<string> | null;
			window?: {
				cursor?: string | null;
				limit?: number | null;
			} | null;
		};
		archived?: boolean | null;
	}>

	export type SearchQueryPayload = {
		__typename?: 'Query';
		results?: Array<{
			__typename: 'Team';
			id: string;
			title: string;
			updatedAt: string;
		} | {
			__typename: 'User';
			id: string;
			name: string;
			updatedAt: string;
		}>;
	}

	export const searchQuery: TypedDocumentNode<SearchQueryPayload, SearchQueryVariables>

	export default searchQuery
}
