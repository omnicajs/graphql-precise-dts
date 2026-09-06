import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type RemoveGroupMutationVariables = Exact<{
	id: string;
}>

export type RemoveGroupMutationPayload = {
	__typename?: 'Mutation';
	removeGroup: {
		__typename?: 'RemoveGroupPayload';
		id: string;
	};
}

export const removeGroupMutation: TypedDocumentNode<RemoveGroupMutationPayload, RemoveGroupMutationVariables>

export default removeGroupMutation
