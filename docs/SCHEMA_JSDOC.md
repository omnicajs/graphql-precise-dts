# Schema JSDoc

Generated schema support files preserve GraphQL SDL descriptions and selected standard directives as JSDoc.

The plugin renders schema JSDoc in:

- `schema.d.ts` for scalars, input object types, object/interface output types, unions, fields, input fields,
and field argument types;
- `enums.ts` for enum declarations and enum values.

## SDL Descriptions

GraphQL SDL descriptions are rendered as JSDoc comments.

For example:

```graphql
"Common user fields."
type User {
  "Stable user identifier."
  id: ID!
  "Date when the user was created."
  createdAt: DateTime!
}
```

is rendered as:

```ts
/** Common user fields. */
export type User = {
  /**
   * Stable user identifier.
   * @remarks Scalar reference: `Scalars['ID']['output']`.
   */
  id: string;
  /**
   * Date when the user was created.
   * @remarks Scalar reference: `Scalars['DateTime']['output']`.
   */
  createdAt: Date;
}
```

Descriptions are supported for:

- scalars;
- enums;
- enum values;
- input object types;
- input object fields;
- object and interface types;
- object and interface fields;
- unions;
- field arguments.

## Scalar References

Schema field, input field, and argument types are rendered as concrete TypeScript types after scalar mapping is applied.
The original scalar lookup is preserved in a JSDoc `@remarks` tag.

For example, with `DateTime` mapped to `Date`:

```graphql
type User {
  createdAt: DateTime!
}
```

is rendered as:

```ts
export type User = {
  /** @remarks Scalar reference: `Scalars['DateTime']['output']`. */
  createdAt: Date;
}
```

For input positions, the plugin uses the scalar input side:

```graphql
type Query {
  user(id: ID!): User
}
```

```ts
export type QueryUserArgs = {
  /** @remarks Scalar reference: `Scalars['ID']['input']`. */
  id: string;
}
```

## Deprecated Schema Members

The standard `@deprecated(reason: "...")` directive is rendered as a JSDoc `@deprecated` tag for fields, arguments,
input fields, and enum values.

For example:

```graphql
type User {
  "Legacy display name."
  oldName: String @deprecated(reason: "Use name instead")
}
```

is rendered as:

```ts
export type User = {
  /**
   * Legacy display name.
   * @deprecated Use name instead
   * @remarks Scalar reference: `Scalars['String']['output']`.
   */
  oldName?: string | null;
}
```

Enum values are handled the same way:

```graphql
enum Permission {
  GroupCreate
  GroupEdit @deprecated(reason: "Use GroupManage instead")
}
```

```ts
export enum Permission {
  GroupCreate = 'GroupCreate',
  /** @deprecated Use GroupManage instead */
  GroupEdit = 'GroupEdit',
}
```

## Specified Scalars

The standard scalar `@specifiedBy(url: "...")` directive is rendered as a JSDoc `@see` tag on the corresponding
`Scalars` entry.

For example:

```graphql
"ISO date-time string."
scalar DateTime @specifiedBy(url: "https://scalars.graphql.org/andimarek/date-time.html")
```

is rendered as:

```ts
export type Scalars = {
  /**
   * ISO date-time string.
   * @see https://scalars.graphql.org/andimarek/date-time.html
   */
  DateTime: { input: string; output: Date; };
}
```

## Unsupported Or Non-Generated Metadata

The plugin does not currently render JSDoc for metadata that has no generated TypeScript declaration target.

This includes:

- descriptions on the root `schema { ... }` definition;
- directive definitions and directive arguments;
- custom documentation directives such as `@doc`, `@tag`, or `@internal`;
- custom type-level deprecation directives on whole object, input, scalar, union, or enum declarations.

Field descriptions are rendered on schema fields. They are not duplicated on generated field argument alias types;
argument aliases render comments for the arguments themselves.
