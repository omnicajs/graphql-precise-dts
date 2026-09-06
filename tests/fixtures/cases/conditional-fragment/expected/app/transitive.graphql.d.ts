import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type Inner = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		id: string;
	} | null;
}

export type BaseThroughInner = {
	__typename?: 'Query';
} & Inner

export type TransitiveExtra = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		name: string;
	} | null;
}

export type TransitiveQueryVariables = Exact<{
	details: boolean;
}>

export type TransitiveQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		id: string;
		name?: string;
	} | null;
}

export const transitiveQuery: TypedDocumentNode<TransitiveQueryPayload, TransitiveQueryVariables>

export default transitiveQuery
