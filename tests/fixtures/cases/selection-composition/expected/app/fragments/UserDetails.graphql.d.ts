declare module 'fragments/UserDetails.graphql' {
	export type UserDetails = {
		__typename?: 'User';
		name: string;
		profile: {
			__typename?: 'Profile';
			nickname: string | null;
		};
	}
}
