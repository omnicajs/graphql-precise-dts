declare module 'fragments/user_fields.graphql' {
	import type { user_status } from '@naming/enums'

	export type userFields = {
		__typename?: 'UserProfile';
		id: string;
		status: user_status;
	}
}
