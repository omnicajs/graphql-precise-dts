import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type RepeatedAliasQueryVariables = { [key: string]: never }

export type RepeatedAliasQueryPayload = {
	__typename?: 'Query';
	pet: {
		__typename: string | null;
		name: string | null;
	} | null;
}

export const repeatedAliasQuery: TypedDocumentNode<RepeatedAliasQueryPayload, RepeatedAliasQueryVariables>

export default repeatedAliasQuery
