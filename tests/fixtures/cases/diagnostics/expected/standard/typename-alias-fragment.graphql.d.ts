import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type FragmentAliasQueryVariables = { [key: string]: never }

export type FragmentAliasQueryPayload = {
	__typename: string | null;
}

export const fragmentAliasQuery: TypedDocumentNode<FragmentAliasQueryPayload, FragmentAliasQueryVariables>

export default fragmentAliasQuery

export type ResponseAlias = {
	__typename: string | null;
}
