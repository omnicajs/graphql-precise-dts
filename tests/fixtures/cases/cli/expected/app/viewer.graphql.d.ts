import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type ViewerQueryVariables = { [key: string]: never }

export type ViewerQueryPayload = {
	__typename?: 'Query';
	viewer: string;
}

export const viewerQuery: TypedDocumentNode<ViewerQueryPayload, ViewerQueryVariables>

export default viewerQuery
