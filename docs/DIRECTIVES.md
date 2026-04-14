# Directives

The plugin distinguishes between two classes of directives:

- built-in `@include` and `@skip`;
- custom directives, for which the user explicitly defines a policy via `directivePolicies`.

The main principle is:

- if a selection is guaranteed not to appear in the result, it is removed from the declaration;
- if a selection may be present or absent at runtime, it becomes optional;
- if a directive does not affect the response shape, the declaration remains unchanged;
- when directives affect abstract fields, they may also change how fallback `__typename` is rendered.

## Built-in `@include` and `@skip`

For built-in directives, the plugin uses static interpretation whenever possible.

### Statically known result

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

### Runtime condition

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

### Conditional spread

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

## `__typename` and abstract fields

For abstract selections such as interfaces and unions, the plugin may synthesize fallback `__typename` values even when `__typename` is not selected explicitly.

Current behavior:

- for concrete object shapes, an aliased `__typename` selection such as `kind: __typename` suppresses the synthesized fallback `__typename`; the alias is rendered as a regular field with a string-literal union value;
- if there is no explicit `__typename` selection and the result splits into distinct concrete branches, branch-level fallback `__typename` is rendered as required so the union stays discriminated;
- if `__typename` is selected conditionally, or only in part of the branches, fallback `__typename` stays optional;
- if branch-specific rendering collapses to the same shape, the plugin merges those branches into a single object type and renders `__typename` as a union of possible string literals.

Reserved name rule:

- aliasing any non-`__typename` field to the response name `__typename` is rejected by the plugin because `__typename` is reserved for typename-specific handling.

## Custom directives

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

## Cases

### `conditional`

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

### `exclude`

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

### `exclude` on an inline fragment of an abstract field

```graphql
fragment GroupOwner on Group {
  owner {
    id
    ... on UserPayload @clientOnly {
      __typename
    }
  }
}
```

Config:

```ts
{
  directivePolicies: {
    clientOnly: {
      inlineFragment: { effect: 'exclude' },
    },
  },
}
```

Expected declaration:

```ts
export type GroupOwner = {
  __typename?: 'Group';
  owner: {
    __typename?: 'UserPayload' | 'AdminPayload';
    id: string;
  };
}
```

Logic:

- the inline fragment is removed from the model entirely;
- explicit `__typename` from that inline fragment is removed with it;
- the remaining abstract field still keeps an optional fallback `__typename` based on the possible runtime types of `owner`.

### `ignore`

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

### `conditional` on an inline fragment of an abstract field

```graphql
query GroupOwnerQuery($withTypeName: Boolean!) {
  group {
    ...GroupOwner
  }
}

fragment GroupOwner on Group {
  owner {
    id
    ... on UserPayload @include(if: $withTypeName) {
      __typename
    }
  }
}
```

Expected declaration:

```ts
export type GroupOwner = {
  __typename?: 'Group';
  owner: {
    __typename?: 'UserPayload' | 'AdminPayload';
    id: string;
  };
}
```

Logic:

- the inline fragment may or may not contribute `__typename` at runtime;
- because the selection is conditional, the generated `__typename` on the abstract field must remain optional;
- since both concrete branches render to the same final shape, the plugin collapses them into one object type instead of keeping a redundant union.

### `override-type`

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

### `nonnull`

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

### `warn`

```graphql
fragment UserCard on User {
  id @review
}
```

Config:

```ts
{
  directivePolicies: {
    review: {
      field: { effect: 'warn', message: 'Manual review required' },
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

Logic:

- the generated shape does not change;
- the plugin emits a warning during model building.
