import type { user_status } from '@naming/enums'

export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type query = {
	__typename?: 'Query';
	users: Array<user_profile>;
}

export type query_users_args = {
	status?: user_status | null;
}

export type user_profile = {
	__typename?: 'UserProfile';
	id: string;
	status: user_status;
}
