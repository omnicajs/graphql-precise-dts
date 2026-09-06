import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { SharedDetails } from '../fragments/group.graphql'

export type GroupDetailsQueryVariables = { [key: string]: never }

export type GroupDetailsQueryPayload = {
	__typename?: 'Query';
	group: {
		__typename?: 'Group';
	} & SharedDetails;
}

export const groupDetailsQuery: TypedDocumentNode<GroupDetailsQueryPayload, GroupDetailsQueryVariables>

export default groupDetailsQuery
