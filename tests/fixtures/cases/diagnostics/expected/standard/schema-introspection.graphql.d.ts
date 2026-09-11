import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type SchemaInfoQueryVariables = { [key: string]: never }

export type SchemaInfoQueryPayload = {
	__typename?: 'Query';
	__schema: {
		__typename?: '__Schema';
		queryType: {
			__typename?: '__Type';
			name: string | null;
		};
	};
}

export const schemaInfoQuery: TypedDocumentNode<SchemaInfoQueryPayload, SchemaInfoQueryVariables>

export default schemaInfoQuery
