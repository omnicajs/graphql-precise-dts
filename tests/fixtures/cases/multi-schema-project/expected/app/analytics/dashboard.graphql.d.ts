declare module 'analytics/dashboard.graphql' {
	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type DashboardQueryVariables = { [key: string]: never }

	export type DashboardQueryPayload = {
		__typename?: 'Query';
		dashboard: {
			__typename?: 'AnalyticsDashboard';
			activeVisitors: number;
		};
	}

	export const dashboardQuery: TypedDocumentNode<DashboardQueryPayload, DashboardQueryVariables>

	export default dashboardQuery
}
