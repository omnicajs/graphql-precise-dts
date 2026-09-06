import type { NodeFields } from './NodeFields.graphql'

import type { UserIdentity } from './UserIdentity.graphql'

export type GroupDetails = {
	__typename?: 'Group';
	name: string;
	owner: {
		__typename?: 'User';
	} & UserIdentity;
} & NodeFields

declare const document: import('graphql').DocumentNode

export default document
