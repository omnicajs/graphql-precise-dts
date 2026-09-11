import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type OtherFields = {
	__typename?: 'Other';
	second: string | null;
}

export type RootFields = {
	__typename?: 'Other';
} & OtherFields | {
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
