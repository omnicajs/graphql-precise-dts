import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { GroupDetails } from '../fragments/GroupDetails.graphql'

import type { UserIdentity } from '../fragments/UserIdentity.graphql'

export type GroupsQueryVariables = { [key: string]: never }

export type GroupsQueryPayload = {
	__typename?: 'Query';
	groups: Array<{
		__typename?: 'Group';
		members: Array<{
			__typename?: 'User';
		} & UserIdentity>;
	} & GroupDetails>;
}

export const groupsQuery: TypedDocumentNode<GroupsQueryPayload, GroupsQueryVariables>

export default groupsQuery
