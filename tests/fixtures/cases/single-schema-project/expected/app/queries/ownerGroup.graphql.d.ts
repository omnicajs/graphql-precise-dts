import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserWithGroups } from '../fragments/UserWithGroups.graphql'

export type OwnerGroupQueryVariables = Exact<{
	id: string;
}>

export type OwnerGroupQueryPayload = {
	__typename?: 'Query';
	ownerGroup: {
		__typename?: 'UserCreatedPayload';
	} & UserWithGroups | null;
}

export const ownerGroupQuery: TypedDocumentNode<OwnerGroupQueryPayload, OwnerGroupQueryVariables>

export default ownerGroupQuery
