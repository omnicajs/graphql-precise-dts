declare module 'mixed/dashboard.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type DashboardUser = {
		__typename?: 'User';
		id: string;
		name: string;
	}

	export type DashboardUsersQueryVariables = { [key: string]: never }

	export type DashboardUsersQueryPayload = {
		__typename?: 'Query';
		users: Array<{
			__typename?: 'User';
		} & DashboardUser>;
	}

	export const dashboardUsersQuery: TypedDocumentNode<DashboardUsersQueryPayload, DashboardUsersQueryVariables>

	export type DashboardGroupsQueryVariables = { [key: string]: never }

	export type DashboardGroupsQueryPayload = {
		__typename?: 'Query';
		groups: Array<{
			__typename?: 'Group';
			id: string;
			owner: {
				__typename?: 'User';
			} & DashboardUser;
		}>;
	}

	export const dashboardGroupsQuery: TypedDocumentNode<DashboardGroupsQueryPayload, DashboardGroupsQueryVariables>
}
