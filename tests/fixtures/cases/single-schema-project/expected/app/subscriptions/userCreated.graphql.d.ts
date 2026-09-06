import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { UserWithGroups } from '../fragments/UserWithGroups.graphql'

export type UserCreatedSubscriptionVariables = { [key: string]: never }

export type UserCreatedSubscriptionPayload = {
	__typename?: 'Subscription';
	userCreated: {
		__typename?: 'UserCreatedPayload';
		createdAt: string;
	} & UserWithGroups;
}

export const userCreatedSubscription: TypedDocumentNode<UserCreatedSubscriptionPayload, UserCreatedSubscriptionVariables>

export default userCreatedSubscription
