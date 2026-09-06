export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	DateTime: { input: unknown; output: unknown; };
	ID: { input: string; output: string; };
	String: { input: string; output: string; };
}

export type Customer = {
	__typename?: 'Customer';
	email: string;
	id: string;
	name: string;
	updatedAt: unknown;
}

export type Query = {
	__typename?: 'Query';
	customer: Customer;
}

export type QueryCustomerArgs = {
	id: string;
}
