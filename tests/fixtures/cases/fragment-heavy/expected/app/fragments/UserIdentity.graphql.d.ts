import type { NodeFields } from './NodeFields.graphql'

export type UserIdentity = {
	__typename?: 'User';
	name: string;
} & NodeFields

declare const document: import('graphql').DocumentNode

export default document
