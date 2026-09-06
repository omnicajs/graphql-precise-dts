import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserWithGroups } from '../fragments/UserWithGroups.graphql'

export type CreateUserMutationVariables = Exact<{
	input: {
		firstName?: string | null;
		lastName?: string | null;
		name: string;
		username: string;
	};
}>

export type CreateUserMutationPayload = {
	__typename?: 'Mutation';
	createUser: {
		__typename?: 'UserCreatedPayload';
	} & UserWithGroups;
}

export const createUserMutation: TypedDocumentNode<CreateUserMutationPayload, CreateUserMutationVariables>

export default createUserMutation
