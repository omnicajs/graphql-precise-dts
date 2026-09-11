# Directives

Directives are validated against the schema: the definition, location,
repeatability, arguments, and variable usage must be valid. A policy describes
an already declared directive; configuration does not add schema definitions.

Directives on operation, fragment, and variable definitions are also validated,
including variable usages in their arguments. Custom response-shape policies
apply only to field selections, fragment spreads, and inline fragments.

Subscription root selections cannot use `@skip` or `@include`, including on
root-level fragment spreads and inline fragments. Conditional selections below
the root field remain supported.

## Built-in selection presence

| Directive | Selection behavior |
|---|---|
| `@skip(if: true)` | Excluded |
| `@skip(if: false)` | Included |
| `@include(if: false)` | Excluded |
| `@include(if: true)` | Included |
| `@skip(if: $condition)` / `@include(if: $condition)` | Conditional |

Conditional fields can be absent in the response. This differs from a present
field whose GraphQL type permits `null`. Conditionality propagates through
fragment selections and is composed with other occurrences of the same selection.
An unconditional occurrence can make a shared response field required.

For a non-null `User.name: String!` field, `name @include(if: $details)` produces
`name?: string`. If the schema field is nullable, the same selection produces
`name?: string | null`. Check for absence separately from a returned `null`.

## Custom policies

Set `schemas.<id>.directives` in the project API or `directives` in the adapter:

```ts
import { defineNamed } from '@omnicajs/graphql-precise-dts'

const directives = {
  required: { effect: 'nonnull' },
  opaque: { effect: 'override', type: defineNamed('OpaqueId') },
  review: { effect: 'warn', message: 'Check the server contract' },
  mask: {
    field: { effect: 'conditional' },
    fragmentSpread: { effect: 'conditional' },
    inlineFragment: { effect: 'ignore' },
  },
} as const
```

The `OpaqueId` reference must be available to the TypeScript consumer. Use a
structural constructor such as `defineString()` when no separately declared
type is needed; see [scalar and override types](TYPES.md).

| Effect | Supported selection kinds | Behavior |
|---|---|---|
| `ignore` | Field, fragment spread, inline fragment | No custom shape effect |
| `conditional` | Field, fragment spread, inline fragment | Selection may be absent |
| `warn` | Field, fragment spread, inline fragment | Emit a warning |
| `nonnull` | Field | Force the selected value to be non-null |
| `override` | Field | Render the configured structural `TsType` for the field |

A flat shared policy applies to each supported selection kind. A scoped policy
applies only to the listed kind; an omitted scope has no custom effect. Field-only
flat policies have no custom effect on fragment selections. A declared directive
without a policy is still validated but adds no custom response-shape effect.

There is no custom `exclude` policy. Static exclusion follows the built-in
selection directives. The generator describes policy semantics; it does not
execute a resolver or enforce server-side behavior.

## Abstract selections and typename

Abstract selections are represented through concrete variants. Explicit
`__typename` selections and aliases participate in those variants; synthesized
typenames help describe their possible shapes. Conditional typenames must not
be treated as unconditionally present discriminators. Test compositions of
inline fragments, named fragments, repeated fields, and conditional selections.

Interfaces without known object implementations retain their selected fields
structurally; their runtime typename is `string`, never the interface's name.

`schemas.<id>.typename` (or `typename` in Codegen) defaults to `'optional'`:
unselected `__typename` is optional. Set `'abstract'` when the client guarantees
that interface and union selections receive an unaliased typename, for example
through Apollo's document transform. This makes implicit discriminators on those
selections required, preserving narrowing in both branches of an `if` or `switch`.
It does not transform the executable document. Concrete object selections remain
optional unless an included fragment carries a required typename. Interfaces without
known implementations keep their implicit string typename optional. Explicitly
conditional typenames stay conditional, and a selected alias
such as `kind: __typename` does not make the canonical `__typename` required.

See [naming](NAMING.md), [types](TYPES.md), and the
[testing guide](https://github.com/omnicajs/graphql-precise-dts/blob/main/docs-dev/en/TESTING.md).
