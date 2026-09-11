import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type UnreachableFragmentFieldsQueryVariables = { [key: string]: never }

export type UnreachableFragmentFieldsQueryPayload = {
	__typename?: 'Query';
	dog: {
		__typename?: 'Dog';
		id: string;
	} & DogFields | null;
}

export const unreachableFragmentFieldsQuery: TypedDocumentNode<UnreachableFragmentFieldsQueryPayload, UnreachableFragmentFieldsQueryVariables>

export default unreachableFragmentFieldsQuery

export type DogFields = {
	__typename?: 'Dog';
}

export type CatFields = {
	__typename?: 'Cat';
	name: string | null;
}
