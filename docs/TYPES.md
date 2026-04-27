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
  booleanType,
  genericType,
  intersectionOf,
  literalType,
  makeNullableType,
  namedType,
  nullType,
  numberType,
  objectType,
  renderType,
  stringType,
  tupleType,
  unionOf,
  unknownType,
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
  | { kind: TS_TYPE_KIND.OBJECT; fields: TsObjectField[] }
  | { kind: TS_TYPE_KIND.TUPLE; items: TsType[] }
  | { kind: TS_TYPE_KIND.LITERAL; value: string | number | boolean }

type TsObjectField = {
  name: string
  type: TsType
  optional?: boolean
}
```

Recommended usage is through helpers instead of manual object construction.

## Available Operations

- `namedType('Date')` for named references and primitives like `string`, `number`, `boolean`
- `nullType()` for `null`
- `unknownType()` for `unknown`
- `arrayOf(type)` for `Array<T>`
- `unionOf(a, b, c)` for `A | B | C`
- `intersectionOf(a, b, c)` for `A & B & C`
- `genericType('Record', stringType(), namedType('User'))` for `Record<string, User>`
- `objectType([{ name: 'id', type: stringType() }])` for object literals
- `tupleType(stringType(), numberType())` for tuples
- `literalType('User')`, `literalType(true)`, `literalType(1)` for literal values
- `makeNullableType(type)` as a convenience wrapper over `unionOf(type, nullType())`
- `renderType(type)` for debug rendering and tests

## Config Usage

### Scalars

```ts
{
  scalars: {
    DateTime: stringType(),
    Timestamp: {
      input: stringType(),
      output: namedType('Date'),
    },
  },
}
```

Nullable scalar output:

```ts
{
  scalars: {
    DateTime: {
      output: unionOf(namedType('Date'), nullType()),
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
        type: namedType('OpaqueId'),
      },
    },
  },
}
```

## Examples

### Generic

```ts
genericType('Record', stringType(), namedType('User'))
```

Renders as:

```ts
Record<string, User>
```

### Intersection

```ts
intersectionOf(
  namedType('UserBase'),
  genericType('Partial', namedType('UserMeta')),
)
```

Renders as:

```ts
UserBase & Partial<UserMeta>
```

### Tuple

```ts
tupleType(stringType(), nullType(), namedType('User'))
```

Renders as:

```ts
[string, null, User]
```

### Object

```ts
objectType([
  { name: 'id', type: stringType() },
  { name: 'active', type: booleanType(), optional: true },
])
```

Renders as:

```ts
{
  id: string;
  active?: boolean;
}
```

## Scope of the Model

Only the supported structural operations can be used in config. If a needed TypeScript shape is missing, the model
should be extended explicitly rather than bypassed with arbitrary strings.

## Responsibility Boundaries

The plugin provides a structural TypeScript type model and renders it as declared, but it does not act as a full
TypeScript type checker for custom type expressions.

The plugin does not validate:

- whether a named type such as `namedType('UserId')` actually exists in your TypeScript environment;
- whether a generic type such as `genericType('Record', ...)` exists in your project;
- whether the number of generic arguments matches what the target generic expects;
- whether generic arguments are supplied in a semantically correct order;
- whether the chosen argument shapes are semantically valid for a given generic;
- whether intersections or unions are meaningful in your domain model beyond their structural rendering;
- whether object field names or compositions conflict with external types you intersect or wrap;
- whether a custom type expression is actually imported or otherwise available where the generated declarations are consumed.

In practice this means:

- the plugin guarantees only structural rendering of the configured `TsType`;
- TypeScript semantic correctness remains the responsibility of the user and the downstream consumer type-checking step.
