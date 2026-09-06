import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserStatus } from '@app/graphql/schema'

export type StatusQueryVariables = { [key: string]: never }

export type StatusQueryPayload = {
	__typename?: 'Query';
	status: UserStatus;
}

export const statusQuery: TypedDocumentNode<StatusQueryPayload, StatusQueryVariables>

export default statusQuery
