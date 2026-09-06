import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserWithGroups } from '../fragments/UserWithGroups.graphql'

export type UserQueryVariables = Exact<{
	id: string;
}>

export type UserQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'UserCreatedPayload';
	} & UserWithGroups | null;
}

export const userQuery: TypedDocumentNode<UserQueryPayload, UserQueryVariables>

export default userQuery
