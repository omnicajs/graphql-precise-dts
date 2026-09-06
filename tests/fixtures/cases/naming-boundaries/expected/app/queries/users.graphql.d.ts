import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type FetchHttp2UsersQueryVariables = { [key: string]: never }

export type FetchHttp2UsersQueryPayload = {
	__typename?: 'Query';
	users: string;
}

export const fetchHttp2UsersQuery: TypedDocumentNode<FetchHttp2UsersQueryPayload, FetchHttp2UsersQueryVariables>

export default fetchHttp2UsersQuery
