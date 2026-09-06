export type AgentFields = {
	__typename: 'Person';
	firstName: string;
} | {
	__typename: 'Team';
	title: string;
}

declare const document: import('graphql').DocumentNode

export default document
