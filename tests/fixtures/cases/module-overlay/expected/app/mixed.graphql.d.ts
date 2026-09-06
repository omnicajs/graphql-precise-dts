import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type SummaryQueryVariables = { [key: string]: never }

export type SummaryQueryPayload = {
	__typename?: 'Query';
	book: {
		__typename?: 'Book';
	} & Local;
}

export const summaryQuery: TypedDocumentNode<SummaryQueryPayload, SummaryQueryVariables>

export default summaryQuery

export type Local = {
	__typename?: 'Book';
	title: string;
}
