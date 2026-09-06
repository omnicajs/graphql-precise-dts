import type { Exact } from '@case/schema'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { GroupDetails } from '../fragments/GroupDetails.graphql'

export type OwnerGroupChangedSubscriptionVariables = Exact<{
	groupId: string;
}>

export type OwnerGroupChangedSubscriptionPayload = {
	__typename?: 'Subscription';
	ownerGroupChanged: {
		__typename?: 'OwnerGroupChangedPayload';
		changedAt: string;
	} & GroupDetails;
}

export const ownerGroupChangedSubscription: TypedDocumentNode<OwnerGroupChangedSubscriptionPayload, OwnerGroupChangedSubscriptionVariables>

export default ownerGroupChangedSubscription
