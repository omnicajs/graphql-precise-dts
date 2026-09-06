import type { user_status } from '@naming/enums'

export type userFields = {
	__typename?: 'UserProfile';
	id: string;
	status: user_status;
}

declare const document: import('graphql').DocumentNode

export default document
