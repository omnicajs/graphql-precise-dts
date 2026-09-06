# Module path resolution

A physical GraphQL file has a source path and a declaration module ID. The source
path identifies its owner within a project and its location in the output tree.
The module ID identifies the document in an ambient aggregate. Tree imports are
resolved by TypeScript against the physical declaration files.

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

## Tree and aggregate formats

`outputs.tree` mirrors the project's document paths as external `.graphql.d.ts`
modules. Imports between generated documents are relative to their output paths.
A single operation has a default `TypedDocumentNode<Payload, Variables>` export,
including documents with local fragments. Fragment-only documents export their
fragment types and a default `DocumentNode` from `graphql`. Documents with multiple
operations have named typed operation exports and a default `DocumentNode`.

`outputs.aggregate` and the Codegen adapter produce ambient `declare module`
blocks using module IDs. The aggregate is rendered separately from the same plan;
it is not a concatenation of the tree. Its existing export contract is retained:
a default typed export requires one definition, which must be an operation.

## TypeScript consumer configuration

For the schema output above and a declaration tree in `generated/operations`,
the consumer can use this `tsconfig.json` at the configuration root:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "rootDirs": ["src", "generated/operations"],
    "paths": {
      "@app/graphql/*": ["./src/*", "./generated/operations/*"],
      "@app/graphql/schema": ["./generated/schema/schema.d.ts"],
      "@app/graphql/enums": ["./generated/schema/enums.ts"]
    }
  },
  "include": [
    "src/**/*.ts",
    "generated/schema/**/*",
    "generated/operations/**/*.graphql.d.ts"
  ]
}
```

Adapt the module settings to the application's build system. The essential
parts are the schema/enum mappings and the operation overlay. `rootDirs` resolves
relative document imports from source files against the separate declaration
tree. Aliased imports also need the fallback in `paths`; `rootDirs` alone does
not provide that fallback. For a project using `@/`, use
`"@/*": ["./src/*", "./generated/operations/*"]`. Keep the runtime loader
pointing at the source documents. A broad `*.graphql` stub discards the precise
operation contract.

Use non-relative identifiers such as `@app/graphql/schema` for `typesModule` and
`enumsModule`, especially when also emitting an aggregate: inside ambient modules, relative
import declarations such as `from './schema'` are invalid.

To consume `generated/operations/aggregate.d.ts`, include that file instead of
the tree glob and remove the tree fallback. Its ambient module IDs supply the
document imports directly. Test tree and aggregate consumers separately so an
ambient module cannot hide an incomplete overlay. Independent projects with
identical ambient module IDs require separate TypeScript projects.

Keep the installed `@graphql-typed-document-node/core` declarations available.
These settings describe types; configure GraphQL loading separately in the
application's bundler or runtime.

## Codegen adapter

The adapter's `root` defaults to the current working directory. Documents must
have locations, parsed ASTs, and paths inside that root. `resolve.alias`,
`typesModule`, and `enumsModule` follow the same module-identity rules.
The adapter returns an aggregate; GraphQL Code Generator owns its destination.

See [configuration examples](../README.md) and the [generation flow](https://github.com/omnicajs/graphql-precise-dts/blob/main/docs-dev/en/FLOW.md).
