# Naming

The plugin can normalize generated TypeScript identifiers with `namingConvention`.

By default, the plugin normalizes generated TypeScript identifiers that are not runtime GraphQL object keys.
Schema type names, enum member identifiers, operation declaration base names, and fragment export names use PascalCase.
Field names, input field names, field argument names, and operation variable names stay unchanged.

## Config Shape

```ts
const NAMING_STYLE = {
  KEEP: 'keep',
  PASCAL_CASE: 'pascalCase',
  CAMEL_CASE: 'camelCase',
  SNAKE_CASE: 'snakeCase',
} as const

type NAMING_STYLE = typeof NAMING_STYLE[keyof typeof NAMING_STYLE]

type NamingConventionConfig = {
  typeNames?: NAMING_STYLE
  enumValues?: NAMING_STYLE
  operationNames?: NAMING_STYLE
  fragmentNames?: NAMING_STYLE
  transformUnderscore?: boolean
}
```

Short form:

```ts
{
  namingConvention: 'pascalCase',
}
```

With exported constants:

```ts
import { NAMING_STYLE } from '@omnicajs/graphql-precise-dts'

{
  namingConvention: NAMING_STYLE.PASCAL_CASE,
}
```

Object form:

```ts
{
  namingConvention: {
    typeNames: 'pascalCase',
    enumValues: NAMING_STYLE.KEEP,
  },
}
```

## Defaults

```ts
{
  typeNames: 'pascalCase',
  enumValues: 'pascalCase',
  operationNames: 'pascalCase',
  fragmentNames: 'pascalCase',
  transformUnderscore: true,
}
```

The short string form configures `typeNames`, `enumValues`, `operationNames`, and `fragmentNames`. Runtime GraphQL keys
are not configurable, so GraphQL response objects and variable objects always keep their original keys.

## What Each Category Controls

| Category | Applies to | Default |
| --- | --- | --- |
| `typeNames` | schema object types, input object types, interfaces, unions, enum type names, generated schema references | `pascalCase` |
| `enumValues` | TypeScript enum member identifiers | `pascalCase` |
| `operationNames` | operation declaration base names | `pascalCase` |
| `fragmentNames` | fragment declaration export names and fragment spread references | `pascalCase` |

## Derived Generated Names

Some generated TypeScript identifiers do not have dedicated config fields. They are derived from the configured
categories:

| Generated name | Derived from |
| --- | --- |
| operation payload, variables, and document base names | `operationNames` |
| operation type suffixes, such as `Query`, `Mutation`, and `Subscription` | `typeNames` |
| field argument helper names, such as `QueryRootUserProfileArgs` | `typeNames` |
| variable alias names, such as `UserFilterInputAlias` | `typeNames` |
| output alias names, such as `UserProfileAlias` | `typeNames` |

For example, `query_root.user_profile` arguments become `QueryRootUserProfileArgs` by default.

## Examples

Given this schema:

```graphql
schema {
  query: query_root
}

enum user_status {
  IS_ACTIVE
}

input user_filter {
  user_status: user_status
}

type user_profile {
  user_id: ID!
  status: user_status!
}

type query_root {
  user_profile(filter_by: user_filter): user_profile
}
```

Default output uses PascalCase for generated identifiers and keeps field/argument keys:

```ts
export enum UserStatus {
  IsActive = 'IS_ACTIVE',
}

export type UserFilter = {
  user_status?: UserStatus | null;
}

export type UserProfile = {
  __typename?: 'user_profile';
  user_id: Scalars['ID']['output'];
  status: UserStatus;
}

export type QueryRootUserProfileArgs = {
  filter_by?: UserFilter | null;
}
```

To keep GraphQL enum member names:

```ts
{
  namingConvention: {
    enumValues: NAMING_STYLE.KEEP,
  },
}
```

renders:

```ts
export enum UserStatus {
  IS_ACTIVE = 'IS_ACTIVE',
}
```

## Runtime Key Caveat

Fields, input fields, arguments, and operation variables are GraphQL runtime keys. The plugin always keeps them
unchanged so generated types match the actual JSON and variables used by GraphQL.

For example, a GraphQL field named `first_name` is returned as:

```json
{ "first_name": "Ada" }
```

not:

```json
{ "firstName": "Ada" }
```

These runtime key categories are intentionally not part of `namingConvention`.

`__typename` string literal values always remain GraphQL runtime type names. If a schema type is named `user_profile`,
the generated type declaration may be `UserProfile`, but `__typename` remains `'user_profile'`.

## Collision Handling

Names are validated after normalization, at the point where generated TypeScript identifiers are rendered.

Generation fails with a collision diagnostic when different GraphQL names render to the same TypeScript identifier in
the same generated namespace. This includes:

- schema declaration names, such as object, input, interface, union, enum, and generated field argument helper names;
- enum member names inside the same enum declaration;
- document declaration exports, such as fragment types, operation payload/variables types, operation document values,
  imported fragment/enum types, and generated reusable aliases.

For example, with the default `pascalCase` style, schema types named `UserStatus` and `user_status` both render as
`UserStatus`; generation fails instead of silently overwriting one declaration.
