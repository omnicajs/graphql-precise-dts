import type { TypedDocumentNode } from '@graphql-typed-document-node/core'

export type IntrospectionDetailsQueryVariables = { [key: string]: never }

export type IntrospectionDetailsQueryPayload = {
	__typename?: 'Query';
	__schema: {
		__typename?: '__Schema';
		types: Array<{
			__typename?: '__Type';
		} & TypeMetadata>;
		directives: Array<{
			__typename?: '__Directive';
			name: string;
			locations: Array<'ARGUMENT_DEFINITION' | 'ENUM' | 'ENUM_VALUE' | 'FIELD' | 'FIELD_DEFINITION' | 'FRAGMENT_DEFINITION' | 'FRAGMENT_SPREAD' | 'INLINE_FRAGMENT' | 'INPUT_FIELD_DEFINITION' | 'INPUT_OBJECT' | 'INTERFACE' | 'MUTATION' | 'OBJECT' | 'QUERY' | 'SCALAR' | 'SCHEMA' | 'SUBSCRIPTION' | 'UNION' | 'VARIABLE_DEFINITION'>;
			args: Array<{
				__typename?: '__InputValue';
			} & InputMetadata>;
		}>;
	};
}

export const introspectionDetailsQuery: TypedDocumentNode<IntrospectionDetailsQueryPayload, IntrospectionDetailsQueryVariables>

export default introspectionDetailsQuery

export type TypeMetadata = {
	__typename?: '__Type';
	kind: 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'LIST' | 'NON_NULL' | 'OBJECT' | 'SCALAR' | 'UNION';
	name: string | null;
	specifiedByURL: string | null;
	isOneOf: boolean | null;
	fields: Array<{
		__typename?: '__Field';
		name: string;
		args: Array<{
			__typename?: '__InputValue';
		} & InputMetadata>;
		type: {
			__typename?: '__Type';
			kind: 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'LIST' | 'NON_NULL' | 'OBJECT' | 'SCALAR' | 'UNION';
			name: string | null;
			ofType: {
				__typename?: '__Type';
				kind: 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'LIST' | 'NON_NULL' | 'OBJECT' | 'SCALAR' | 'UNION';
				name: string | null;
			} | null;
		};
	}> | null;
	inputFields: Array<{
		__typename?: '__InputValue';
	} & InputMetadata> | null;
	enumValues: Array<{
		__typename?: '__EnumValue';
		name: string;
		isDeprecated: boolean;
	}> | null;
}

export type InputMetadata = {
	__typename?: '__InputValue';
	name: string;
	defaultValue: string | null;
	isDeprecated: boolean;
	type: {
		__typename?: '__Type';
		kind: 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'LIST' | 'NON_NULL' | 'OBJECT' | 'SCALAR' | 'UNION';
		name: string | null;
	};
}
