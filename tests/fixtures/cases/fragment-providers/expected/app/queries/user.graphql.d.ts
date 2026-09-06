declare module 'queries/user.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { SharedDetails } from 'fragments/user.graphql'

	export type UserDetailsQueryVariables = { [key: string]: never }

	export type UserDetailsQueryPayload = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
		} & SharedDetails;
	}

	export const userDetailsQuery: TypedDocumentNode<UserDetailsQueryPayload, UserDetailsQueryVariables>

	export default userDetailsQuery
}
