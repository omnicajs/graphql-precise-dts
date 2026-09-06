export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }

export type MaybePromise<T> = T | Promise<T>

export type Scalars = {
	Boolean: { input: boolean; output: boolean; };
	String: { input: string; output: string; };
	Timestamp: { input: {
		metadata: Readonly<{
			enabled: boolean;
			fallback?: unknown;
			'source-id': string;
			value?: unknown;
		}>;
		range: [number, number | null];
		tags?: Array<string | null>;
	}; output: Readonly<{
		epoch: number;
		iso: string;
	}> & {
		kind: 'timestamp';
		precision: 3;
		verified: true;
	} & ({
		timezone: 'utc';
	} | {
		timezone: 'local';
	}); };
	constructor: { input: unknown; output: unknown; };
}

export type Query = {
	__typename?: 'Query';
	event: Readonly<{
		epoch: number;
		iso: string;
	}> & {
		kind: 'timestamp';
		precision: 3;
		verified: true;
	} & ({
		timezone: 'utc';
	} | {
		timezone: 'local';
	});
	value: unknown;
}

export type QueryEventArgs = {
	at: {
		metadata: Readonly<{
			enabled: boolean;
			fallback?: unknown;
			'source-id': string;
			value?: unknown;
		}>;
		range: [number, number | null];
		tags?: Array<string | null>;
	};
}
