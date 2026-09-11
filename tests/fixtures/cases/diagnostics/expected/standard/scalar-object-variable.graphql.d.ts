import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type ScalarVariableQueryVariables = Exact<{
	text: string;
}>

export type ScalarVariableQueryPayload = {
	__typename?: 'Query';
	echo: string | null;
}

export const scalarVariableQuery: TypedDocumentNode<ScalarVariableQueryPayload, ScalarVariableQueryVariables>

export default scalarVariableQuery
