export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	ID: { input: string; output: string; };
	JSON: { input: unknown; output: unknown; };
	String: { input: string; output: string; };
}

export type Cat = Pet & {
	__typename?: 'Cat';
	name?: string | null;
	nickname?: string | null;
}

export type Dog = Pet & {
	__typename?: 'Dog';
	id: string;
	name?: string | null;
}

export type Item = L | R

export type L = Left & {
	__typename?: 'L';
	left?: string | null;
}

export type Left = {
	__typename?: 'L';
	left?: string | null;
}

export type Other = Rootish & {
	__typename?: 'Other';
	common?: string | null;
	second?: string | null;
}

export type Pet = {
	__typename?: 'Cat' | 'Dog';
	name?: string | null;
}

export type Query = {
	__typename?: 'Query';
	dog?: Dog | null;
	echo?: string | null;
	item?: Item | null;
	nested?: Query | null;
	pet?: Pet | null;
}

export type QueryEchoArgs = {
	text?: string | null;
	value?: unknown | null;
}

export type R = Right & {
	__typename?: 'R';
	right?: string | null;
}

export type Right = {
	__typename?: 'R';
	right?: string | null;
}

export type Rootish = {
	__typename?: 'Other' | 'Subscription';
	common?: string | null;
}

export type Subscription = Rootish & {
	__typename?: 'Subscription';
	common?: string | null;
	event?: string | null;
	first?: string | null;
	item?: Item | null;
}
