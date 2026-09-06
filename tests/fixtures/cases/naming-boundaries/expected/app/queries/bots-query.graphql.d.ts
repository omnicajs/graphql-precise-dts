import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type FetchMgBotsQueryVariables = { [key: string]: never }

export type FetchMgBotsQueryPayload = {
	__typename?: 'Query';
	users: string;
}

export const fetchMgBotsQuery: TypedDocumentNode<FetchMgBotsQueryPayload, FetchMgBotsQueryVariables>

export default fetchMgBotsQuery
