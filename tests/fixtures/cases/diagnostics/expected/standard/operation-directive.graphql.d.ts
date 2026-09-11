import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type DefinitionDirectiveQueryVariables = { [key: string]: never }

export type DefinitionDirectiveQueryPayload = {
	__typename?: 'Query';
	echo: string | null;
}

export const definitionDirectiveQuery: TypedDocumentNode<DefinitionDirectiveQueryPayload, DefinitionDirectiveQueryVariables>

export default definitionDirectiveQuery
