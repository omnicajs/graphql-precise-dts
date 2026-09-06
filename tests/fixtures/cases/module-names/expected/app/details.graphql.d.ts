import type { document } from './document.graphql'

export type Details = {
	__typename?: string;
	label: string;
} & document

declare const _document: import('graphql').DocumentNode

export default _document
