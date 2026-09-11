import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type TypenameAliasQueryVariables = { [key: string]: never }

export type TypenameAliasQueryPayload = {
	__typename: string | null;
}

export const typenameAliasQuery: TypedDocumentNode<TypenameAliasQueryPayload, TypenameAliasQueryVariables>

export default typenameAliasQuery
