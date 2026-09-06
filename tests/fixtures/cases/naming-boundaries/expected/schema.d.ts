export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	String: { input: string; output: string; };
}

export enum UserStatus {
	active = 'active',
}

export type Query = {
	__typename?: 'Query';
	ok: boolean;
	status: UserStatus;
	users: string;
}
