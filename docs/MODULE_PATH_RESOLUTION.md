# Module Path Resolution

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

## Why the full path is used instead of `basename`

When `scope` does not match, the plugin does not fall back to `basename(documentLocation)`. Using only the file name would make module ids unstable and colliding for common layouts such as:

```ts
'queries/index.graphql'
'mutations/index.graphql'
```

Both would collapse to the same module id if only `index.graphql` were used. The plugin therefore keeps the path portion needed to preserve document identity.
