# Types

`@omnicajs/graphql-precise-dts` uses a structural `TsType` model for custom scalar mappings and directive
`override-type` policies.

String-based type config is not supported. Custom types must be built with the exported helpers.

## Public API

Import helpers from the package root:

```ts
import {
  TS_TYPE_KIND,
  arrayOf,
  defineBoolean,
  defineGeneric,
  defineLiteral,
  defineNamed,
  defineNull,
  defineNumber,
  defineObject,
  defineObjectField,
  defineString,
  defineTuple,
  defineUnknown,
  intersectionOf,
  unionOf,
  makeNullable,
  renderType,
} from '@omnicajs/graphql-precise-dts'
```

## TsType

```ts
type TsType =
  | { kind: TS_TYPE_KIND.NAMED; name: string }
  | { kind: TS_TYPE_KIND.NULL }
  | { kind: TS_TYPE_KIND.UNKNOWN }
  | { kind: TS_TYPE_KIND.ARRAY; ofType: TsType }
  | { kind: TS_TYPE_KIND.UNION; types: TsType[] }
  | { kind: TS_TYPE_KIND.INTERSECTION; types: TsType[] }
  | { kind: TS_TYPE_KIND.GENERIC; name: string; args: TsType[] }
  | { kind: TS_TYPE_KIND.OBJECT; fields: NamedObjectField[] }
  | { kind: TS_TYPE_KIND.TUPLE; items: TsType[] }
  | { kind: TS_TYPE_KIND.LITERAL; value: string | number | boolean }

type ObjectFieldConfig = {
  type: TsType
  optional: boolean
}

type NamedObjectField = {
  name: string
} & ObjectFieldConfig
```

Recommended usage is through helpers instead of manual object construction.

## Available Operations

- `defineNamed('Date')` for named references and primitives like `string`, `number`, `boolean`
- `defineNull()` for `null`
- `defineUnknown()` for `unknown`
- `arrayOf(type)` for `Array<T>`
- `unionOf(a, b, c)` for `A | B | C`
- `intersectionOf(a, b, c)` for `A & B & C`
- `defineGeneric('Record', defineString(), defineNamed('User'))` for `Record<string, User>`
- `defineObject({ id: defineObjectField(defineString()) })` for object literals
- `defineTuple(defineString(), defineNumber())` for tuples
- `defineLiteral('User')`, `defineLiteral(true)`, `defineLiteral(1)` for literal values
- `makeNullable(type)` as a convenience wrapper over `unionOf(type, defineNull())`
- `renderType(type)` for debug rendering and tests

## Config Usage

### Scalars

```ts
{
  scalars: {
    DateTime: defineString(),
    Timestamp: {
      input: defineString(),
      output: defineNamed('Date'),
    },
  },
}
```

Nullable scalar output:

```ts
{
  scalars: {
    DateTime: {
      output: unionOf(defineNamed('Date'), defineNull()),
    },
  },
}
```

### Directive Override Types

```ts
{
  directivePolicies: {
    opaque: {
      field: {
        effect: 'override-type',
        type: defineNamed('OpaqueId'),
      },
    },
  },
}
```

## Examples

### Generic

```ts
defineGeneric('Record', defineString(), defineNamed('User'))
```

Renders as:

```ts
Record<string, User>
```

### Intersection

```ts
intersectionOf(
  defineNamed('UserBase'),
  defineGeneric('Partial', defineNamed('UserMeta')),
)
```

Renders as:

```ts
UserBase & Partial<UserMeta>
```

### Tuple

```ts
defineTuple(defineString(), defineNull(), defineNamed('User'))
```

Renders as:

```ts
[string, null, User]
```

### Object

```ts
defineObject({
  id: defineObjectField(defineString()),
  active: defineObjectField(defineBoolean(), true),
})
```

Renders as:

```ts
{
  id: string;
  active?: boolean;
}
```

## Scope of the Model

`ObjectFieldConfig` is the public input helper shape for `defineObject(...)`.
`NamedObjectField` is the normalized internal object-member representation stored inside `TsType`.
Both types are exported so consumers can build object-member values either through the provided helpers or manually
when that is more convenient for their use case.

Example:

```ts
defineObject({
  id: defineObjectField(defineString()),
  profile: defineObjectField(
    defineObject({
      displayName: defineObjectField(defineString()),
    }),
    true,
  ),
})
```

Only the supported structural operations can be used in config. If a needed TypeScript shape is missing, the model
should be extended explicitly rather than bypassed with arbitrary strings.

## Responsibility Boundaries

The plugin provides a structural TypeScript type model and renders it as declared, but it does not act as a full
TypeScript type checker for custom type expressions.

The plugin does not validate:

- whether a named type such as `defineNamed('UserId')` actually exists in your TypeScript environment;
- whether a generic type such as `defineGeneric('Record', ...)` exists in your project;
- whether the number of generic arguments matches what the target generic expects;
- whether generic arguments are supplied in a semantically correct order;
- whether the chosen argument shapes are semantically valid for a given generic;
- whether intersections or unions are meaningful in your domain model beyond their structural rendering;
- whether object field names or compositions conflict with external types you intersect or wrap;
- whether a custom type expression is actually imported or otherwise available where the generated declarations are consumed.

In practice this means:

- the plugin guarantees only structural rendering of the configured `TsType`;
- TypeScript semantic correctness remains the responsibility of the user and the downstream consumer type-checking step.
