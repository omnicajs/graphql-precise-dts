export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	Int: { input: number; output: number; };
	String: { input: string; output: string; };
}

export type CoreDashboard = {
	__typename?: 'CoreDashboard';
	openOrders: number;
}

export type Query = {
	__typename?: 'Query';
	dashboard: CoreDashboard;
}
