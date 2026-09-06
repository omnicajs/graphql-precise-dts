declare module 'queries/customer.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type CustomerQueryVariables = Exact<{
		id: string;
	}>

	export type CustomerQueryPayload = {
		__typename?: 'Query';
		customer: {
			__typename?: 'Customer';
			id: string;
			name: string;
		};
	}

	export const customerQuery: TypedDocumentNode<CustomerQueryPayload, CustomerQueryVariables>

	export default customerQuery
}
