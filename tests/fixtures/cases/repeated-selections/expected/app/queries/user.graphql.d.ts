declare module 'queries/user.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type UserQueryVariables = Exact<{
		id: string;
		withName: boolean;
	}>

	export type UserQueryPayload = {
		__typename: 'Query';
		maybeType?: 'Query';
		user: {
			__typename?: 'User';
			id: string;
			name: string;
			nickname: string | null;
			conditionalNickname?: string | null;
		};
	}

	export const userQuery: TypedDocumentNode<UserQueryPayload, UserQueryVariables>

	export default userQuery
}
