import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserDetails } from '../fragments/UserDetails.graphql'

export type GroupMembersQueryVariables = Exact<{
	groudId: string;
}>

export type GroupMembersQueryPayload = {
	__typename?: 'Query';
	groupMembers: Array<{
		__typename?: 'UserCreatedPayload';
	} & UserDetails>;
}

export const groupMembersQuery: TypedDocumentNode<GroupMembersQueryPayload, GroupMembersQueryVariables>

export default groupMembersQuery
