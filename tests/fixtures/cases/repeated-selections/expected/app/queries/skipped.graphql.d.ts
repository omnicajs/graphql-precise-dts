import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type SkippedFirstQueryVariables = { [key: string]: never }

export type SkippedFirstQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		id: string;
	};
}

export const skippedFirstQuery: TypedDocumentNode<SkippedFirstQueryPayload, SkippedFirstQueryVariables>

export type SelectedFirstQueryVariables = { [key: string]: never }

export type SelectedFirstQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		id: string;
	};
}

export const selectedFirstQuery: TypedDocumentNode<SelectedFirstQueryPayload, SelectedFirstQueryVariables>

export type BothSkippedQueryVariables = { [key: string]: never }

export type BothSkippedQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
	};
}

export const bothSkippedQuery: TypedDocumentNode<BothSkippedQueryPayload, BothSkippedQueryVariables>

export type NestedSkippedFirstQueryVariables = { [key: string]: never }

export type NestedSkippedFirstQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		friend: {
			__typename?: 'User';
			id: string;
		} | null;
	};
}

export const nestedSkippedFirstQuery: TypedDocumentNode<NestedSkippedFirstQueryPayload, NestedSkippedFirstQueryVariables>

export type NestedSelectedFirstQueryVariables = { [key: string]: never }

export type NestedSelectedFirstQueryPayload = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		friend: {
			__typename?: 'User';
			id: string;
		} | null;
	};
}

export const nestedSelectedFirstQuery: TypedDocumentNode<NestedSelectedFirstQueryPayload, NestedSelectedFirstQueryVariables>

declare const document: import('graphql').DocumentNode

export default document
