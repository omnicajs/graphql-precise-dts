import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type ReversedAliasQueryVariables = { [key: string]: never }

export type ReversedAliasQueryPayload = {
	__typename?: 'Query';
	pet: {
		name: string | null;
		__typename: string | null;
	} | null;
}

export const reversedAliasQuery: TypedDocumentNode<ReversedAliasQueryPayload, ReversedAliasQueryVariables>

export default reversedAliasQuery
