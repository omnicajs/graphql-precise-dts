declare module 'same-name.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type SameNameQueryVariables = { [key: string]: never }

	export type SameNameQueryPayload = {
		__typename?: 'Query';
	} & SameName

	export const sameNameQuery: TypedDocumentNode<SameNameQueryPayload, SameNameQueryVariables>

	export type SameName = {
		__typename: 'Query';
	}
}
