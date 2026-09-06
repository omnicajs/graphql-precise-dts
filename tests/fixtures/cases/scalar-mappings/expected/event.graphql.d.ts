declare module 'queries/event.graphql' {
	import type { Exact } from '@app/graphql/schema'

	import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

	export type EventQueryVariables = Exact<{
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
	}>

	export type EventQueryPayload = {
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
	}

	export const eventQuery: TypedDocumentNode<EventQueryPayload, EventQueryVariables>

	export default eventQuery
}
