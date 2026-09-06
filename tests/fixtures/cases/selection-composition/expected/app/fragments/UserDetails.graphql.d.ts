export type UserDetails = {
	__typename?: 'User';
	name: string;
	profile: {
		__typename?: 'Profile';
		nickname: string | null;
	};
}

declare const document: import('graphql').DocumentNode

export default document
