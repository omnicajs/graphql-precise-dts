export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Audit: { input: unknown; output: unknown; };
	Boolean: { input: boolean; output: boolean; };
	Date: { input: string; output: string; };
	Float: { input: number; output: number; };
	ID: { input: string; output: string; };
	Int: { input: number; output: number; };
	String: { input: string; output: string; };
}

export enum Status {
	ACTIVE = 'ACTIVE',
	INACTIVE = 'INACTIVE',
}

export type DefaultedFilter = {
	required?: string;
}

export type Group = Node & {
	__typename?: 'Group';
	child?: Node | null;
	id: string;
	label: string;
	owner: User;
	value?: number | null;
}

export type Node = {
	__typename?: 'Group' | 'User';
	child?: Node | null;
	id: string;
	value?: number | null;
}

export type PlainFilter = {
	text?: string | null;
}

export type Query = {
	__typename?: 'Query';
	date: string;
	defaulted?: boolean | null;
	node?: Node | null;
	plain?: boolean | null;
	result?: SearchResult | null;
	search: Array<User>;
	user?: User | null;
	users: Array<User>;
	validate?: boolean | null;
}

export type QueryDefaultedArgs = {
	id?: string;
}

export type QueryNodeArgs = {
	filter?: RecursiveFilter | null;
	id: string;
}

export type QueryPlainArgs = {
	filter?: PlainFilter | null;
}

export type QuerySearchArgs = {
	filter?: SearchFilter | null;
}

export type QueryUserArgs = {
	id: string;
}

export type QueryUsersArgs = {
	ids: Array<string>;
}

export type QueryValidateArgs = {
	boolean?: boolean | null;
	date?: string | null;
	defaulted?: DefaultedFilter | null;
	float?: number | null;
	id?: string | null;
	ids?: Array<string> | null;
	int?: number | null;
	plain?: PlainFilter | null;
	required?: RequiredFilter | null;
	status?: Status | null;
	string?: string | null;
}

export type RecursiveFilter = {
	nested?: RecursiveFilter | null;
}

export type RequiredFilter = {
	optional?: number | null;
	required: string;
}

export type SearchFilter = {
	status: Status;
	term?: never;
} | {
	status?: never;
	term: string;
}

export type SearchResult = Group | User

export type User = Node & {
	__typename?: 'User';
	child?: User | null;
	id: string;
	owner: User;
	related: Array<User>;
	score: number;
	status: Status;
	value: number;
}
