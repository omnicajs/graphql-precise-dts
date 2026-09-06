declare module 'queries/node.graphql' {
	import type { Exact } from '@search/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type NodeQueryVariables = Exact<{
		id: string;
	}>

	export type NodeQueryPayload = {
		__typename?: 'Query';
		node: {
			__typename: 'Team';
			id: string;
			updatedAt: string;
			title: string;
		} | {
			__typename: 'User';
			id: string;
			updatedAt: string;
			name: string;
		} | null;
	}

	export const nodeQuery: TypedDocumentNode<NodeQueryPayload, NodeQueryVariables>

	export default nodeQuery
}

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
