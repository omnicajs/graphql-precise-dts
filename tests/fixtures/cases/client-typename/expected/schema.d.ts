export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	String: { input: string; output: string; };
}

export type Agent = Person | Team

export type Person = {
	__typename?: 'Person';
	firstName: string;
}

export type Query = {
	__typename?: 'Query';
	agent: Agent;
	person: Person;
}

export type Team = {
	__typename?: 'Team';
	title: string;
}
