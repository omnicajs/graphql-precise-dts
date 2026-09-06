import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type SameNameQueryVariables = { [key: string]: never }

export type SameNameQueryPayload = {
	__typename?: 'Query';
} & SameName

export const sameNameQuery: TypedDocumentNode<SameNameQueryPayload, SameNameQueryVariables>

export default sameNameQuery

export type SameName = {
	__typename: 'Query';
}
