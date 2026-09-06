import type { GroupDetails } from './GroupDetails.graphql'

import type { UserDetails } from './UserDetails.graphql'

export type UserWithGroups = {
	__typename?: 'UserCreatedPayload';
	groups: Array<{
		__typename?: 'OwnerGroupChangedPayload';
	} & GroupDetails>;
} & UserDetails

declare const document: import('graphql').DocumentNode

export default document
