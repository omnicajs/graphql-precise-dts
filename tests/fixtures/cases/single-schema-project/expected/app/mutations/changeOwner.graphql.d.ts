import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserWithGroups } from '../fragments/UserWithGroups.graphql'

export type ChangeOwnerMutationVariables = Exact<{
	input: {
		id: string;
	};
}>

export type ChangeOwnerMutationPayload = {
	__typename?: 'Mutation';
	changeOwner: {
		__typename?: 'UserCreatedPayload';
	} & UserWithGroups;
}

export const changeOwnerMutation: TypedDocumentNode<ChangeOwnerMutationPayload, ChangeOwnerMutationVariables>

export default changeOwnerMutation
