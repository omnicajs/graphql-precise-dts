import type { Exact } from '@app/graphql/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type NestedDirectiveSubscriptionVariables = Exact<{
	include: boolean;
}>

export type NestedDirectiveSubscriptionPayload = {
	__typename?: 'Subscription';
	item: {
		__typename?: 'L';
		left?: string | null;
	} | {
		__typename?: 'R';
	} | null;
}

export const nestedDirectiveSubscription: TypedDocumentNode<NestedDirectiveSubscriptionPayload, NestedDirectiveSubscriptionVariables>

export default nestedDirectiveSubscription
