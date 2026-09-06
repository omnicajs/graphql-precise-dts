declare module 'fragments/User.graphql' {
	export type UserById = {
		__typename?: 'Query';
		user: {
			__typename?: 'User';
			id: string;
			name?: string;
		} | null;
	}
}
