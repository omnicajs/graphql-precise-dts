import type { Exact } from '@search/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type NodeQueryVariables = Exact<{
	id: string;
}>

export type NodeQueryPayload = {
	__typename?: 'Query';
	node: {
		__typename: 'Team';
		id: string;
		updatedAt: string;
		title: string;
	} | {
		__typename: 'User';
		id: string;
		updatedAt: string;
		name: string;
	} | null;
}

export const nodeQuery: TypedDocumentNode<NodeQueryPayload, NodeQueryVariables>

export default nodeQuery
