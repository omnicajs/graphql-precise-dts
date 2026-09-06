# Structural TypeScript types

Scalar mappings and field overrides use `TsType` values, not TypeScript source
strings. Import constructors and their public types from
`@omnicajs/graphql-precise-dts`.

## Constructors

| Constructor | Meaning |
|---|---|
| `defineString()`, `defineNumber()`, `defineBoolean()` | Primitive named types |
| `defineNamed(name)` | Named type reference; `unknown` uses the dedicated unknown variant |
| `defineUnknown()`, `defineNull()` | `unknown`, `null` |
| `defineLiteral(value)` | String, number, or boolean literal |
| `arrayOf(type)` | Array of a structural type |
| `unionOf(first, ...rest)` | Union |
| `intersectionOf(first, ...rest)` | Intersection |
| `defineGeneric(name, first, ...rest)` | Generic type application |
| `defineTuple(...items)` | Tuple, including the empty tuple |
| `defineObject(fields)` | Object from a keyed field map |
| `defineObjectField(type, optional?)` | Object field configuration; required by default |
| `makeNullable(type)` | Union with `null` |

Groups flatten nested groups of the same kind, normalize nested values, remove
structural duplicates, and collapse a single remaining member. Constructors
return data; generation renders it in the appropriate scalar or field context.

## Scalar directions

A mapping can apply to both input and output or configure them independently:

```ts
import {
  defineNamed,
  defineString,
  defineObject,
  defineObjectField,
  defineBoolean,
  unionOf,
  defineNull,
} from '@omnicajs/graphql-precise-dts'

const scalars = {
  DateTime: { input: defineString(), output: defineNamed('Date') },
  Metadata: defineObject({
    id: defineObjectField(defineString()),
    archived: defineObjectField(defineBoolean(), true),
  }),
  OptionalDate: unionOf(defineNamed('Date'), defineNull()),
}
```

Put mappings under `schemas.<id>.scalars` in the project API or `scalars` in the
Codegen adapter configuration. Named types must be available to the TypeScript
consumer; a `defineNamed` call does not install a package or declare that type.

GraphQL wrappers still control list and field nullability. Variable defaults,
input-field defaults, and selection conditionality determine optional properties
at their respective boundaries; a scalar mapping is not a replacement for those
GraphQL rules.

## Checking the consumer contract

An operation exports its variables, response payload, and a `TypedDocumentNode`
declaration. Use `VariablesOf<typeof document>` and `ResultOf<typeof document>`
from `@graphql-typed-document-node/core` to consume those types. The application
must include the operation declarations and their schema dependencies in its
[TypeScript project](MODULE_PATH_RESOLUTION.md#typescript-consumer-configuration).

A schema output type describes the schema's fields; it is not the response type
of every operation on that object. Use the operation payload for selected fields,
aliases, and conditional properties. For example, a scalar mapped to `Date` on
output requires the client to actually produce `Date` values; declarations alone
do not convert JSON strings into dates.

## Data shape

The public `TsType` union has `named`, `unknown`, `null`, `literal`, `array`,
`union`, `intersection`, `generic`, `object`, and `tuple` variants. In particular,
a generic stores `arguments`, an array stores `ofType`, and an object stores a
list of `{ name, type, optional }` fields. Prefer constructors for normalization
and use the exported `TsType` interfaces when authoring typed configuration.

Runtime configuration validation checks these structures before generation.
An arbitrary string such as `"Date | null"` is not a scalar mapping.

See [configuration examples](../README.md) and [directives](DIRECTIVES.md).
