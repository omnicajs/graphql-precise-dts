import type { ReviewState } from '@app/graphql/enums'

export type BookFields = {
	__typename?: 'Book';
	id: string;
	state: ReviewState;
}

declare const document: import('graphql').DocumentNode

export default document
