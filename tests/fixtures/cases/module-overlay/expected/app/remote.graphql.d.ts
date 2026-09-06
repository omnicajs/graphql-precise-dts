import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { ReviewState } from '@app/graphql/enums'

export type RemoteQueryVariables = Exact<{
	details: boolean;
}>

export type RemoteQueryPayload = {
	__typename?: 'Query';
	payload: {
		__typename?: string;
		kind: string;
		id: string;
		state?: ReviewState;
	};
}

export const remoteQuery: TypedDocumentNode<RemoteQueryPayload, RemoteQueryVariables>

export default remoteQuery

export type RemoteFields = {
	__typename?: string;
	state: ReviewState;
}
