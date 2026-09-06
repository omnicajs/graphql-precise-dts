declare module 'viewer.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type Details = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
			name: string;
		} | null;
	}

	export type ViewerQueryVariables = Exact<{
		details: boolean;
	}>

	export type ViewerQueryPayload = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
			id: string;
			name?: string;
		} | null;
	}

	export const viewerQuery: TypedDocumentNode<ViewerQueryPayload, ViewerQueryVariables>
}
