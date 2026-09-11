import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type SiblingAliasQueryVariables = { [key: string]: never }

export type SiblingAliasQueryPayload = {
	__typename?: 'Query';
	dog: {
		__typename: string | null;
		id: string;
	} | null;
}

export const siblingAliasQuery: TypedDocumentNode<SiblingAliasQueryPayload, SiblingAliasQueryVariables>

export default siblingAliasQuery

export type DogFields = {
	__typename?: 'Dog';
	id: string;
}
