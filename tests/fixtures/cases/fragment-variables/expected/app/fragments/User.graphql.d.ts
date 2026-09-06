export type UserById = {
	__typename?: 'Query';
	user: {
		__typename?: 'User';
		id: string;
		name?: string;
	} | null;
}

declare const document: import('graphql').DocumentNode

export default document
