# Module Path Resolution

The plugin generates `declare module '...'` blocks and import paths for GraphQL documents. These module ids are built from:

- `prefix`: the alias root added to every generated module path;
- `scope`: an optional path fragment used to cut the document path from a stable point;
- `relativeToCwd`: an optional flag that makes fallback paths relative to `process.cwd()`;
- `paths`: an optional alias map for imports from document declarations to generated schema support files.

The resolution order is:

1. If `scope` matches the document location, the plugin uses the suffix starting from the scope root.
2. If `scope` does not match:
   - with `relativeToCwd: true`, the plugin uses the path relative to `process.cwd()`;
   - with `relativeToCwd: false`, the plugin uses the normalized document path as-is for relative locations;
   - with `relativeToCwd: false` and an absolute document location, the plugin still converts it to a path relative to `process.cwd()` so the alias prefix is not combined with an absolute filesystem path.

In practice, `prefix` behaves as an alias root, and the remaining part of the module id is a stable document path. When `prefix` is empty, the plugin emits a real relative module specifier and adds `./` when needed.

## `scope` matches

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

## `scope` does not match

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

## `relativeToCwd: true`

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

## Absolute document path with `relativeToCwd: false`

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

## Empty `prefix`

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

## Schema support output directory

`schemaOutputDirectory` controls where schema support files are written:

```ts
{
  schemaOutputDirectory: 'schema',
}
```

For a generated declaration target such as:

```txt
types/graphql-documents.d.ts
```

the plugin writes support files to:

```txt
types/schema/schema.d.ts
types/schema/enums.ts
```

Relative `schemaOutputDirectory` values are resolved from the generated declaration file directory. Absolute paths are
used as-is.

This setting does not change generated GraphQL document module ids. It only changes support file locations and the
relative enum imports emitted inside the generated declaration file.

## Generated schema imports with `paths`

When schema support files are stored separately from the generated document declaration file, relative imports can expose
the same generated types through a different module id than the one application code uses. Configure `paths` to make
document declarations import generated schema helpers and enums through the public alias:

> [!WARNING]
> Important: if application code imports generated schema support modules through an alias, but the plugin config does
> not define a matching `paths` entry, generated document declarations will fall back to relative imports. TypeScript may
> then see the same generated file through two different module specifiers, for example a relative path in generated
> declarations and an alias in application code. This can lead to duplicated module identities, mismatched imports, or
> declarations that do not line up with the module path used by consumers.

```ts
{
  schemaOutputDirectory: '../packages/graphql/generated',
  paths: {
    '@example/graphql/generated/*': [ 'packages/graphql/generated/*' ],
  },
}
```

With this config, imports inside document declarations use:

```ts
import type { Exact } from '@example/graphql/generated/schema'
import type { Permission } from '@example/graphql/generated/enums'
```

`paths` entries are matched against generated support file paths after normalizing `.ts` and `.d.ts` extensions. If no
entry matches, imports fall back to relative module specifiers.

## Why the full path is used instead of `basename`

When `scope` does not match, the plugin does not fall back to `basename(documentLocation)`. Using only the file name would make module ids unstable and colliding for common layouts such as:

```ts
'queries/index.graphql'
'mutations/index.graphql'
```

Both would collapse to the same module id if only `index.graphql` were used. The plugin therefore keeps the path portion needed to preserve document identity.
