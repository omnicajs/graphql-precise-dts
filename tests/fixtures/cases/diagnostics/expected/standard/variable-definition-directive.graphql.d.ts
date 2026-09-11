import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type DefinitionDirectiveQueryVariables = Exact<{
	text?: string | null;
}>

export type DefinitionDirectiveQueryPayload = {
	__typename?: 'Query';
	echo: string | null;
}

export const definitionDirectiveQuery: TypedDocumentNode<DefinitionDirectiveQueryPayload, DefinitionDirectiveQueryVariables>

export default definitionDirectiveQuery
