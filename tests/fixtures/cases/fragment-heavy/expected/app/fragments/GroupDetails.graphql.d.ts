declare module 'fragments/GroupDetails.graphql' {
	import type { NodeFields } from 'fragments/NodeFields.graphql'

	import type { UserIdentity } from 'fragments/UserIdentity.graphql'

	export type GroupDetails = {
		__typename?: 'Group';
		name: string;
		owner: {
			__typename?: 'User';
		} & UserIdentity;
	} & NodeFields
}
