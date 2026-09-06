import type { Permission } from '@case/enums'

import type { UserDetails } from './UserDetails.graphql'

export type GroupDetails = {
	__typename?: 'OwnerGroupChangedPayload';
	id: string;
	name: string;
	owner: {
		__typename?: 'UserCreatedPayload';
		permissions: Array<Permission>;
	} & UserDetails;
	createdBy: {
		__typename?: 'UserCreatedPayload';
	} & UserDetails;
	createdAt: string;
}

declare const document: import('graphql').DocumentNode

export default document
