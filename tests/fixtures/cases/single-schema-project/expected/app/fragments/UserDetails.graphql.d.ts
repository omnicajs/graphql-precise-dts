export type UserDetails = {
	__typename?: 'UserCreatedPayload';
	id: string;
	username: string;
	firstName: string | null;
	lastName: string | null;
	isOnline: boolean;
}

declare const document: import('graphql').DocumentNode

export default document
