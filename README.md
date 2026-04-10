# graphql-precise-dts

`@omnicajs/graphql-precise-dts` is a GraphQL Code Generator plugin that generates TypeScript declaration files for GraphQL documents.

The generated declarations:

- keep fragment and operation types scoped to the corresponding `.graphql` module;
- generate `TypedDocumentNode` declarations for operations;
- emit a sibling `schema.d.ts` file with enums and scalar mappings;
- account for directives that can change the runtime response shape.

## Installation

Install the plugin together with its runtime type dependencies:

```bash
yarn add -D @graphql-codegen/cli @omnicajs/graphql-precise-dts
yarn add graphql @graphql-typed-document-node/core
```

`@graphql-typed-document-node/core` is required because generated declarations import `TypedDocumentNode` from that package.

## Usage

Example GraphQL Code Generator config:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'src/schema.graphql',
  documents: [ 'src/**/*.graphql' ],
  generates: {
    'src/generated/types.d.ts': {
      plugins: [ '@graphql-codegen/graphql-precise-dts' ],
      config: {
        prefix: '~/',
        scope: 'src/',
        relativeToCwd: false,
        scalars: {
          DateTime: 'string',
        },
      },
    },
  },
}

export default config
```

## Output

For a target like:

```txt
src/generated/types.d.ts
```

the plugin produces:

- `src/generated/types.d.ts` with `declare module '...'` blocks for GraphQL documents;
- `src/generated/schema.d.ts` with:
  - `export type Scalars = ...`
  - `export type MyEnum = ...`

Operation declarations are emitted as typed document exports:

```ts
export type GetUserQuery = ...
export type GetUserQueryVariables = Exact<...>
export const getUserQuery: TypedDocumentNode<GetUserQuery, GetUserQueryVariables>
export default getUserQuery
```

## Configuration

Supported plugin config:

```ts
type PluginConfig = {
  prefix?: string
  scope?: string
  relativeToCwd?: boolean
  scalars?: Record<string, string | { input?: string; output?: string }>
  directivePolicies?: Record<string, DirectivePolicy | DirectiveNodePolicies>
}
```

### `prefix`

Prefix prepended to generated GraphQL module ids.

Example:

```ts
{ prefix: '~tests/' }
```

can produce:

```ts
declare module '~tests/fragments/UserDetails.graphql' { ... }
```

If `prefix` is empty, relative module specifiers are used instead.

### `scope`

Optional path prefix used to preserve only the scoped part of the document path in module ids.

Example:

```ts
{
  prefix: '~tests/',
  scope: 'fixtures/documents/',
}
```

for a document at `tests/fixtures/documents/fragments/UserDetails.graphql` produces:

```ts
declare module '~tests/fixtures/documents/fragments/UserDetails.graphql' { ... }
```

### `relativeToCwd`

When enabled, absolute document paths are normalized relative to `process.cwd()` before generating module ids.

### `scalars`

Overrides scalar TypeScript types.

Examples:

```ts
{
  scalars: {
    DateTime: 'string',
  },
}
```

or:

```ts
{
  scalars: {
    DateTime: {
      input: 'string',
      output: 'Date',
    },
  },
}
```

## Working with directives

The plugin distinguishes between two classes of directives:

- built-in `@include` and `@skip`;
- custom directives, for which the user explicitly defines a policy via `directivePolicies`.

The main principle is:

- if a selection is guaranteed not to appear in the result, it is removed from the declaration;
- if a selection may be present or absent at runtime, it becomes optional;
- if a directive does not affect the response shape, the declaration remains unchanged.

### Built-in `@include` and `@skip`

For built-in directives, the plugin uses static interpretation whenever possible.

#### Statically known result

```graphql
fragment UserCard on User {
  id
  email @skip(if: true)
  name @include(if: true)
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id: string;
  name: string;
}
```

Logic:

- `@skip(if: true)` always excludes `email` from the result;
- `@include(if: true)` does not change the shape and is treated as a regular field.

#### Runtime condition

```graphql
query UserCardQuery($withEmail: Boolean!) {
  user {
    ...UserCard
  }
}

fragment UserCard on User {
  id
  email @include(if: $withEmail)
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id: string;
  email?: string | null;
}
```

Logic:

- the directive value is not known at generation time;
- the field may be absent in the runtime response;
- therefore `?:` is used instead of only `| null`.

#### Conditional spread

```graphql
fragment UserCard on User {
  id
  ...UserMeta @skip(if: $hideMeta)
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id: string;
} & Partial<UserMeta>
```

Logic:

- the entire fragment spread contribution may be absent;
- therefore the spread is rendered as `Partial<...>`.

### Custom directives

The plugin does not try to infer custom directive semantics from the directive name. You need to define an explicit policy for them:

```ts
{
  directivePolicies: {
    mask: {
      field: { effect: 'conditional' },
    },
    clientOnly: {
      inlineFragment: { effect: 'exclude' },
    },
    opaque: {
      field: { effect: 'override-type', type: 'OpaqueId' },
    },
    required: {
      field: { effect: 'nonnull' },
    },
    review: {
      field: { effect: 'warn', message: 'Manual review required' },
    },
  },
}
```

Supported policies:

- `ignore`: does not affect the result type;
- `exclude`: the selection is removed from the declaration;
- `conditional`: the selection is treated as runtime-conditional and becomes optional;
- `nonnull`: removes `| null` from the field type;
- `override-type`: replaces the rendered field type with a custom TypeScript type;
- `warn`: emits a warning without changing the generated shape.

Policies can be defined:

- directly for the directive name;
- or per target kind: `field`, `fragmentSpread`, `inlineFragment`.

### Cases

#### `conditional`

```graphql
fragment UserCard on User {
  id @mask
}
```

Config:

```ts
{
  directivePolicies: {
    mask: {
      field: { effect: 'conditional' },
    },
  },
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id?: string;
}
```

#### `exclude`

```graphql
fragment UserCard on User {
  id
  email @clientOnly
}
```

Config:

```ts
{
  directivePolicies: {
    clientOnly: {
      field: { effect: 'exclude' },
    },
  },
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id: string;
}
```

#### `ignore`

```graphql
fragment UserCard on User {
  id @trace
}
```

Config:

```ts
{
  directivePolicies: {
    trace: {
      field: { effect: 'ignore' },
    },
  },
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id: string;
}
```

#### `override-type`

```graphql
fragment UserCard on User {
  id @opaque
}
```

Config:

```ts
{
  directivePolicies: {
    opaque: {
      field: { effect: 'override-type', type: 'OpaqueId' },
    },
  },
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  id: OpaqueId;
}
```

#### `nonnull`

```graphql
fragment UserCard on User {
  nickname @required
}
```

Config:

```ts
{
  directivePolicies: {
    required: {
      field: { effect: 'nonnull' },
    },
  },
}
```

Expected declaration:

```ts
export type UserCard = {
  __typename?: 'User';
  nickname: string;
}
```
