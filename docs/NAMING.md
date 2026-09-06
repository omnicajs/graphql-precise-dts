# Naming

Naming changes generated TypeScript identifiers. GraphQL response keys, argument
names, input keys, variables, and enum member names keep their runtime spelling.
A field alias determines its response key at every selection level.

## Configuration

Set `schemas.<id>.naming` in the project API or `naming` in the Codegen adapter:

```ts
naming: 'pascalCase'
```

A style applies to type, operation, and fragment names. The object form controls
the three categories separately:

```ts
naming: {
  typeNames: 'pascalCase',
  operationNames: 'camelCase',
  fragmentNames: 'keep',
}
```

Supported styles are `keep`, `pascalCase`, `camelCase`, and `snakeCase`.
`typeNames` defaults to `pascalCase`; omitted operation and fragment styles
inherit `typeNames`. There is no runtime-key naming policy.

## Operation names

The operation kind participates in generated names. An existing matching trailing
kind is not duplicated. For a query named `FetchUser`, the default base is
`FetchUserQuery`; related exports use `FetchUserQueryVariables` and
`FetchUserQueryPayload`. The document value starts with a lowercase first letter.
The `keep` style preserves the operation's spelling and appends derived suffixes
in PascalCase. Names are checked for collisions before rendering.

## Response aliases

```graphql
query FetchUser($id: ID!) {
  payload: user(id: $id) {
    userId: id
    displayName: name
  }
}
```

The response contains `payload`, `userId`, and `displayName`. Naming configuration
does not change these keys. A `kind: __typename` selection retains `kind` as its
response key and uses concrete GraphQL type names as string literal values.

## Schema and enum names

`typeNames` controls schema type identifiers and field-argument type identifiers.
Enum type names follow this policy, while enum member names and serialized values
are preserved. Distinct GraphQL names that normalize to conflicting declarations
produce an error rather than silently sharing a TypeScript type.

Type and value namespaces are checked separately. Module imports, fragment
exports, input declarations, and operation types also participate in the
appropriate collision checks.

See [diagnostics](DIAGNOSTICS.md) and [module paths](MODULE_PATH_RESOLUTION.md).
