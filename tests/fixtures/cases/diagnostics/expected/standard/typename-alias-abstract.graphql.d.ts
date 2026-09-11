import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type AbstractAliasQueryVariables = { [key: string]: never }

export type AbstractAliasQueryPayload = {
	__typename?: 'Query';
	item: {
		__typename: string | null;
	} | {
		__typename: string | null;
	} | null;
}

export const abstractAliasQuery: TypedDocumentNode<AbstractAliasQueryPayload, AbstractAliasQueryVariables>

export default abstractAliasQuery

export type ResponseAlias = {
	__typename: string | null;
} | {
	__typename: string | null;
}
