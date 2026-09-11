import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type TypeInfoQueryVariables = { [key: string]: never }

export type TypeInfoQueryPayload = {
	__typename?: 'Query';
	__type: {
		__typename?: '__Type';
		name: string | null;
	} | null;
}

export const typeInfoQuery: TypedDocumentNode<TypeInfoQueryPayload, TypeInfoQueryVariables>

export default typeInfoQuery
