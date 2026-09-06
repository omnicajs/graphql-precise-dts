import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { BookFields } from '../fragments/BookFields.graphql'

export type FetchBookQueryVariables = Exact<{
	id: string;
}>

export type FetchBookQueryPayload = {
	__typename?: 'Query';
	payload: {
		__typename?: 'Book';
	} & BookFields;
}

export const fetchBookQuery: TypedDocumentNode<FetchBookQueryPayload, FetchBookQueryVariables>

export default fetchBookQuery
