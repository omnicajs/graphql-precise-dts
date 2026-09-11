import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type RootFields = {
	__typename?: 'Other';
	second: string | null;
} | {
	__typename?: 'Subscription';
	first: string | null;
}

export type ApplicableRootSubscriptionVariables = { [key: string]: never }

export type ApplicableRootSubscriptionPayload = {
	__typename?: 'Subscription';
	first: string | null;
}

export const applicableRootSubscription: TypedDocumentNode<ApplicableRootSubscriptionPayload, ApplicableRootSubscriptionVariables>

export default applicableRootSubscription
