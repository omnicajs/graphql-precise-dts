import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { GroupDetails } from '../fragments/GroupDetails.graphql'

export type UserGroupsQueryVariables = Exact<{
	id: string;
}>

export type UserGroupsQueryPayload = {
	__typename?: 'Query';
	userGroups: Array<{
		__typename?: 'OwnerGroupChangedPayload';
	} & GroupDetails>;
}

export const userGroupsQuery: TypedDocumentNode<UserGroupsQueryPayload, UserGroupsQueryVariables>

export default userGroupsQuery
