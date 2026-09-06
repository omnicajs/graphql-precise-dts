import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserWithGroups } from '../fragments/UserWithGroups.graphql'

export type UsersQueryVariables = Exact<{
	filter?: {
		isOnline: boolean;
	} | null;
}>

export type UsersQueryPayload = {
	__typename?: 'Query';
	users: Array<{
		__typename?: 'UserCreatedPayload';
	} & UserWithGroups>;
}

export const usersQuery: TypedDocumentNode<UsersQueryPayload, UsersQueryVariables>

export default usersQuery
