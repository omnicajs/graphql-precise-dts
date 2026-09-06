# Schema JSDoc

Schema support declarations preserve documentation from the GraphQL schema
snapshot. Enable schema output in the project configuration:

```ts
schemas: {
  core: {
    file: 'schema.graphql',
    typesModule: '@app/graphql/schema',
    enumsModule: '@app/graphql/enums',
    outputs: {
      root: 'generated/schema',
      types: 'schema.d.ts',
      enums: 'enums.ts',
    },
  },
}
```

## Supported metadata

| GraphQL metadata | Generated JSDoc |
|---|---|
| SDL description | Description text |
| `@deprecated(reason: ...)` | `@deprecated` with the reason |
| Scalar `@specifiedBy(url: ...)` | `@see` with the URL |

Metadata is rendered where the corresponding declaration is emitted: schema
object/interface/union/input types, fields, arguments, enum types and members,
and scalar entries in the `Scalars` map. A schema-level description has no
standalone TypeScript declaration to attach to.

Multiline text stays multiline. Comment terminators are escaped so schema text
cannot terminate a generated JSDoc block. An empty deprecation reason still
emits the deprecation tag. Values and type expressions are rendered separately
from their documentation.

```graphql
"A user visible to the viewer."
type User {
  "The display name."
  name: String!
  oldName: String @deprecated(reason: "Use name")
}
```

The generated `User` declaration and its fields carry the corresponding comments.
This is schema documentation, not proof that an operation selected every schema
field. Operation response types are compiled from their selection sets.

## Ownership

The project API publishes schema files only when `outputs` is configured.
The Codegen adapter returns operation declarations and does not write schema
support files. With `enumsModule`, schema types import enum types from that
module; without it, enum declarations are included in the schema types module.

See [module paths](MODULE_PATH_RESOLUTION.md) for module identifiers and
[architecture](../docs-dev/en/ARCHITECTURE.md) for snapshot ownership.
