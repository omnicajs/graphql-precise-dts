import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

import type { Status } from '@app/graphql/schema'

export type DirectiveEffectsQueryVariables = { [key: string]: never }

export type DirectiveEffectsQueryPayload = {
	__typename?: 'Query';
	date: string;
	user: {
		__typename?: 'User';
		id: string;
		status: Status;
	};
}

export const directiveEffectsQuery: TypedDocumentNode<DirectiveEffectsQueryPayload, DirectiveEffectsQueryVariables>

export default directiveEffectsQuery

export type UserStatus = {
	__typename?: 'User';
	status: Status;
}
