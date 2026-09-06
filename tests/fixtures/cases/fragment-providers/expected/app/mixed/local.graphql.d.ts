declare module 'mixed/local.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type SharedDetails = {
		__typename?: 'User';
		id: string;
	}

	export type LocalDetailsQueryVariables = { [key: string]: never }

	export type LocalDetailsQueryPayload = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
		} & SharedDetails;
	}

	export const localDetailsQuery: TypedDocumentNode<LocalDetailsQueryPayload, LocalDetailsQueryVariables>
}
