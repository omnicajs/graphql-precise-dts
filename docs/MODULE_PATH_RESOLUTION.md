# Module path resolution

A physical GraphQL file has a source path and a declaration module ID. The source
path identifies its owner within a project. The module ID is what consumers use
when importing that GraphQL document.

## Project roots and document selection

`config.root` anchors schema files, project roots, caches, and output paths.
`projects.<id>.root` anchors that project's document selection. Aliases use
`config.root` as their base.
A target chooses documents with exactly one selector:

```ts
{ files: ['queries/user.graphql'] }
{ glob: { include: ['**/*.graphql'], exclude: ['drafts/**'] } }
{ regexp: /\.graphql$/ }
```

Without an alias, a declaration's module ID is its path relative to the project
root, with forward slashes. Projects own their document namespaces independently.

## Document aliases

`resolve.alias` maps a physical path relative to `config.root` to a module prefix.
For a project whose root is `src`:

```ts
resolve: {
  alias: {
    'src': '@app/graphql',
    'src/generated-documents': '@app/generated-graphql',
  },
}
```

`src/queries/user.graphql` becomes `@app/graphql/queries/user.graphql`.
The most specific matching physical path wins. Prefix matching respects directory
boundaries. Different physical documents resolving to one module ID are rejected.

Aliases control declaration identities; they do not configure TypeScript or a
GraphQL document loader. Configure the consumer's module resolution accordingly.

## Schema and enum modules

`schemas.<id>.typesModule` specifies the module containing the schema support
contract. `enumsModule` optionally names a separate enum module; without it, enum
imports use `typesModule`.

These module specifiers are explicit. Output locations do not automatically turn
into TypeScript aliases. For example:

```ts
{
  file: 'schema.graphql',
  typesModule: '@app/graphql/schema',
  enumsModule: '@app/graphql/enums',
  outputs: {
    root: 'generated/schema',
    types: 'schema.d.ts',
    enums: 'enums.ts',
  },
}
```

## Fragment providers

External spreads require document imports:

```graphql
#import "../fragments/user.graphql"
query FetchUser { user { ...UserDetails } }
```

The provider path is resolved relative to the importing file. Fragment identity
includes its owning document. Local fragments resolve locally; external fragments
must have an explicit, unambiguous provider among the configured documents.
Missing files, missing provider declarations, unavailable providers, and ambiguous
providers produce diagnostics. An alias does not replace a provider import.

## Codegen adapter

The adapter's `root` defaults to the current working directory. Documents must
have locations, parsed ASTs, and paths inside that root. `resolve.alias`,
`typesModule`, and `enumsModule` follow the same module-identity rules.
The adapter returns an aggregate; GraphQL Code Generator owns its destination.

See [configuration examples](../README.md) and the [generation flow](../docs-dev/en/FLOW.md).
