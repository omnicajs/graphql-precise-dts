import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type DirectiveVariablesQueryVariables = Exact<{
	text: string;
	other: string;
}>

export type DirectiveVariablesQueryPayload = {
	__typename?: 'Query';
} & F

export const directiveVariablesQuery: TypedDocumentNode<DirectiveVariablesQueryPayload, DirectiveVariablesQueryVariables>

export default directiveVariablesQuery

export type F = {
	__typename?: 'Query';
	echo: string | null;
}
