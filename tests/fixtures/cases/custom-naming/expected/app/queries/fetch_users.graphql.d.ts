import type { Exact } from '@naming/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { user_status } from '@naming/enums'

import type { userFields } from '../fragments/user_fields.graphql'

export type fetch_users_queryVariables = Exact<{
	status?: user_status | null;
}>

export type fetch_users_queryPayload = {
	__typename?: 'Query';
	users: Array<{
		__typename?: 'UserProfile';
	} & userFields>;
}

export const fetch_users_query: TypedDocumentNode<fetch_users_queryPayload, fetch_users_queryVariables>

export default fetch_users_query
