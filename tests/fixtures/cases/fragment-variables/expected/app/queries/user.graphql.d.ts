import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserById } from '../fragments/User.graphql'

export type UserQueryVariables = Exact<{
	id: string;
	details: boolean;
}>

export type UserQueryPayload = {
	__typename?: 'Query';
} & UserById

export const userQuery: TypedDocumentNode<UserQueryPayload, UserQueryVariables>

export default userQuery
