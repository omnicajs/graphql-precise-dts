import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type DisplayQueryVariables = Exact<{
	show: boolean;
}>

export type DisplayQueryPayload = {
	__typename?: 'Query';
	agent: {
		__typename: 'Person';
		firstName: string;
	} | {
		__typename: 'Team';
		title: string;
	};
	partial: {
		__typename: 'Person';
		firstName: string;
	} | {
		__typename: 'Team';
	};
	person: {
		__typename: 'Person';
		firstName: string;
	};
	conditional: {
		__typename?: 'Person';
		firstName?: string;
	};
	explicit: {
		__typename?: 'Person';
		firstName: string;
	} | {
		__typename?: 'Team';
		title: string;
	};
	aliased: {
		__typename?: 'Person';
		kind: 'Person';
		firstName: string;
	} | {
		__typename?: 'Team';
		kind: 'Team';
		title: string;
	};
}

export const displayQuery: TypedDocumentNode<DisplayQueryPayload, DisplayQueryVariables>

export default displayQuery
