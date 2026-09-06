declare module 'queries/viewer.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	import type { NodeIdentity } from 'fragments/NodeIdentity.graphql'

	export type ViewerQueryVariables = Exact<{
		id: string;
		details: boolean;
	}>

	export type ViewerQueryPayload = {
		__typename?: 'Query';
		node: {
			__typename?: 'Team';
			id: string;
			title: string;
		} & NodeIdentity | {
			__typename?: 'User';
			id: string;
			name: string;
			profile: {
				__typename?: 'Profile';
				displayName: string;
				nickname?: string | null;
			};
		} & NodeIdentity;
	}

	export const viewerQuery: TypedDocumentNode<ViewerQueryPayload, ViewerQueryVariables>

	export default viewerQuery
}
