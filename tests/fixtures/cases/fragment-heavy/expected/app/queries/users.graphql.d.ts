declare module 'queries/users.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { UserGroups } from 'fragments/UserGroups.graphql'

	export type UsersQueryVariables = { [key: string]: never }

	export type UsersQueryPayload = {
		__typename?: 'Query';
		users: Array<{
			__typename?: 'User';
		} & UserGroups>;
	}

	export const usersQuery: TypedDocumentNode<UsersQueryPayload, UsersQueryVariables>

	export default usersQuery
}
