declare module 'composed.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type Base = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
			id: string;
		} | null;
	}

	export type Extra = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
			name: string;
		} | null;
	}

	export type ComposedQueryVariables = Exact<{
		details: boolean;
	}>

	export type ComposedQueryPayload = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
			id: string;
			name?: string;
		} | null;
	}

	export const composedQuery: TypedDocumentNode<ComposedQueryPayload, ComposedQueryVariables>
}
