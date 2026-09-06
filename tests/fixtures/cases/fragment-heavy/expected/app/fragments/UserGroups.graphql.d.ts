declare module 'fragments/UserGroups.graphql' {
	import type { GroupDetails } from 'fragments/GroupDetails.graphql'

	import type { UserIdentity } from 'fragments/UserIdentity.graphql'

	export type UserGroups = {
		__typename?: 'User';
		groups: Array<{
			__typename?: 'Group';
		} & GroupDetails>;
	} & UserIdentity
}
