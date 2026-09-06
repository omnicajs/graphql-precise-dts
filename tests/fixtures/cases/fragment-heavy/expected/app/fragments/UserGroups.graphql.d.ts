import type { GroupDetails } from './GroupDetails.graphql'

import type { UserIdentity } from './UserIdentity.graphql'

export type UserGroups = {
	__typename?: 'User';
	groups: Array<{
		__typename?: 'Group';
	} & GroupDetails>;
} & UserIdentity

declare const document: import('graphql').DocumentNode

export default document
