import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { Details } from './details.graphql'

export type InspectQueryVariables = { [key: string]: never }

export type InspectQueryPayload = {
	__typename?: 'Query';
	item: {
		__typename?: string;
	} & Details;
}

export const inspectQuery: TypedDocumentNode<InspectQueryPayload, InspectQueryVariables>

export default inspectQuery
