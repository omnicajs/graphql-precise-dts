declare module 'only-a.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type NodeValue = {
		__typename?: 'A';
		a: string;
	} | {
		__typename?: 'B';
		b: string;
	}

	export type NodeIdentity = {
		__typename?: 'A' | 'B';
		id: string;
	}

	export type NodeWrapper = {
		__typename?: 'A';
		a: string;
	} | {
		__typename?: 'B';
		b: string;
	}

	export type OnlyAQueryVariables = { [key: string]: never }

	export type OnlyAQueryPayload = {
		__typename?: 'Query';
		onlyA: {
			__typename?: 'A';
			a: string;
			child: {
				__typename?: 'A';
				a: string;
			} & NodeIdentity;
		} & NodeIdentity | null;
	}

	export const onlyAQuery: TypedDocumentNode<OnlyAQueryPayload, OnlyAQueryVariables>
}
