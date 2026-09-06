declare module 'abstract.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type ConditionalNodeFields = {
		__typename?: 'A';
		a: string;
	} | {
		__typename?: 'B';
		b: string;
	}

	export type ConditionalNodeQueryVariables = Exact<{
		details: boolean;
	}>

	export type ConditionalNodeQueryPayload = {
		__typename?: 'Query';
		node: {
			__typename: 'A';
			a?: string;
		} | {
			__typename: 'B';
			b?: string;
		} | null;
	}

	export const conditionalNodeQuery: TypedDocumentNode<ConditionalNodeQueryPayload, ConditionalNodeQueryVariables>
}
