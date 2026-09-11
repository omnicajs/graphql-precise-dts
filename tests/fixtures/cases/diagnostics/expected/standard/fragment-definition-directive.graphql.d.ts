import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type DefinitionDirectiveQueryVariables = { [key: string]: never }

export type DefinitionDirectiveQueryPayload = {
	__typename?: 'Query';
} & F

export const definitionDirectiveQuery: TypedDocumentNode<DefinitionDirectiveQueryPayload, DefinitionDirectiveQueryVariables>

export default definitionDirectiveQuery

export type F = {
	__typename?: 'Query';
	echo: string | null;
}
