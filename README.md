# graphql-precise-dts
This plugin generates TypeScript declaration files for GraphQL documents and accounts for directives that can change the shape of the result.

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

### Practical rule
If a directive affects whether data is present in the response, use:
- built-in `@include` / `@skip` if this is standard GraphQL semantics;
- `directivePolicies.*.effect = 'conditional'` if this is custom runtime conditionality;
- `directivePolicies.*.effect = 'exclude'` if the annotated selection should never be included in the resulting shape;
- `override-type` and `nonnull` only when the directive semantically changes the field type contract.


## Module path resolution
The plugin generates `declare module '...'` blocks and import paths for GraphQL documents. These module ids are built from:

- `prefix`: the alias root added to every generated module path;
- `scope`: an optional path fragment used to cut the document path from a stable point;
- `relativeToCwd`: an optional flag that makes fallback paths relative to `process.cwd()`.

The resolution order is:

1. If `scope` matches the document location, the plugin uses the suffix starting from the scope root.
2. If `scope` does not match:
   - with `relativeToCwd: true`, the plugin uses the path relative to `process.cwd()`;
   - with `relativeToCwd: false`, the plugin uses the normalized document path as-is for relative locations;
   - with `relativeToCwd: false` and an absolute document location, the plugin still converts it to a path relative to `process.cwd()` so the alias prefix is not combined with an absolute filesystem path.

In practice, `prefix` behaves as an alias root, and the remaining part of the module id is a stable document path.
When `prefix` is empty, the plugin emits a real relative module specifier and adds `./` when needed.

### `scope` matches
Config:
```ts
{
  prefix: '~tests/',
  scope: 'fixtures/documents/fragments/',
}
```

Document location:
```ts
'tests/fixtures/documents/fragments/UserDetails.graphql'
```

Module id:
```ts
'~tests/fixtures/documents/fragments/UserDetails.graphql'
```

With an empty prefix:
```ts
'./fixtures/documents/fragments/UserDetails.graphql'
```

### `scope` does not match
Config:
```ts
{
  prefix: '~tests/',
  scope: 'fragments/never-matches/',
}
```

Document location:
```ts
'queries/index.graphql'
```

Module id:
```ts
'~tests/queries/index.graphql'
```

### `relativeToCwd: true`
Config:
```ts
{
  prefix: '~tests/',
  relativeToCwd: true,
}
```

Document location:
```ts
'/repo/tests/fixtures/documents/queries/users.graphql'
```

If `process.cwd()` is `/repo/tests/fixtures/documents`, the module id becomes:
```ts
'~tests/queries/users.graphql'
```

With an empty prefix:
```ts
'./queries/users.graphql'
```

### Absolute document path with `relativeToCwd: false`
Config:
```ts
{
  prefix: '~tests/',
  relativeToCwd: false,
}
```

Document location:
```ts
'/repo/tests/fixtures/documents/mutations/index.graphql'
```

If `process.cwd()` is `/repo/tests/fixtures/documents`, the module id becomes:
```ts
'~tests/mutations/index.graphql'
```

This avoids invalid ids like:
```ts
'~tests//repo/tests/fixtures/documents/mutations/index.graphql'
```

### Empty `prefix`
Config:
```ts
{
  prefix: '',
  relativeToCwd: true,
}
```

Document location:
```ts
'/repo/queries/index.graphql'
```

If `process.cwd()` is `/repo`, the module id becomes:
```ts
'./queries/index.graphql'
```

This is useful when the generated declarations should use plain relative module specifiers instead of an alias namespace.

### Why the full path is used instead of `basename`
When `scope` does not match, the plugin does not fall back to `basename(documentLocation)`. Using only the file name would make module ids unstable and colliding for common layouts such as:

```ts
'queries/index.graphql'
'mutations/index.graphql'
```

Both would collapse to the same module id if only `index.graphql` were used. The plugin therefore keeps the path portion needed to preserve document identity.
