import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type NestedAliasQueryVariables = { [key: string]: never }

export type NestedAliasQueryPayload = {
	__typename?: 'Query';
	nested: {
		__typename?: 'Query';
		pet: {
			__typename: string | null;
			name: string | null;
		} | null;
	} | null;
}

export const nestedAliasQuery: TypedDocumentNode<NestedAliasQueryPayload, NestedAliasQueryVariables>

export default nestedAliasQuery
