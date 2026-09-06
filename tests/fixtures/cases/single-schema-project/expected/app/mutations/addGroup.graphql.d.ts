import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { GroupDetails } from '../fragments/GroupDetails.graphql'

export type AddGroupMutationVariables = Exact<{
	input: {
		createdBy: string;
		name: string;
	};
}>

export type AddGroupMutationPayload = {
	__typename?: 'Mutation';
	addGroup: {
		__typename?: 'OwnerGroupChangedPayload';
	} & GroupDetails;
}

export const addGroupMutation: TypedDocumentNode<AddGroupMutationPayload, AddGroupMutationVariables>

export default addGroupMutation
