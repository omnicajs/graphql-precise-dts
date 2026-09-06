declare module 'fragments/UserIdentity.graphql' {
	import type { NodeFields } from 'fragments/NodeFields.graphql'

	export type UserIdentity = {
		__typename?: 'User';
		name: string;
	} & NodeFields
}
