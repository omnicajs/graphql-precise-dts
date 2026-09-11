# graphql-precise-dts

[![npm version](https://img.shields.io/npm/v/%40omnicajs%2Fgraphql-precise-dts)](https://www.npmjs.com/package/@omnicajs/graphql-precise-dts)
[![codecov](https://codecov.io/gh/omnicajs/graphql-precise-dts/graph/badge.svg)](https://codecov.io/gh/omnicajs/graphql-precise-dts)

`@omnicajs/graphql-precise-dts` generates precise TypeScript declarations for
GraphQL operations and fragments. One compiler serves the project API, CLI,
and GraphQL Code Generator adapter.

- Operations export `TypedDocumentNode` values with response and variable types.
- Response keys follow GraphQL aliases, including nested fields.
- Schema support files describe scalars, inputs, output types, and enums.
- Projects can share a schema or compile targets against different schemas.
- Generation validates documents, reports located diagnostics, and publishes
  owned outputs deterministically. Check mode compares outputs without writing.

## Installation

Requires Node.js 22.14.0 or later in the 22.x series, or Node.js 24.0.0 and
later (`^22.14.0 || >=24.0.0`). Node.js 23 is not supported.

```bash
yarn add -D @omnicajs/graphql-precise-dts
yarn add @graphql-typed-document-node/core
```

Generated declarations import `TypedDocumentNode`; make its package available
in the workspace that consumes those declarations. Configure TypeScript module
resolution to match `typesModule`, `enumsModule`, and any document aliases.

The package exports are:

| Entry | Public contract |
|---|---|
| `@omnicajs/graphql-precise-dts` | Configuration helpers, `generateDeclarations`, `checkDeclarations`, `listProjects` |
| `@omnicajs/graphql-precise-dts/codegen` | `plugin`, `CodegenConfig`, and its `PluginConfig` type alias |
| `graphql-precise-dts` executable | `generate`, `check`, `list` |

## Project API and CLI

Create `graphql-dts.config.ts`:

```ts
import { defineConfig } from '@omnicajs/graphql-precise-dts'

export default defineConfig({
  root: import.meta.dirname,
  cache: { directory: '.cache/graphql-precise-dts' },
  locks: { directory: '.cache/graphql-precise-dts-locks' },
  execution: { mode: 'sequential' },
  resolve: { alias: { src: '@app/graphql' } },
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
  },
  projects: {
    app: {
      root: 'src',
      targets: {
        core: {
          schema: 'core',
          documents: { glob: { include: ['**/*.graphql'] } },
          outputs: { tree: { root: 'generated/operations' } },
        },
      },
    },
  },
})
```

Run it through the package executable:

```bash
graphql-precise-dts generate
graphql-precise-dts check
graphql-precise-dts list
```

The example emits `generated/schema/schema.d.ts`, `generated/schema/enums.ts`,
and one declaration per selected document under `generated/operations/`.
Connect them to the application's [TypeScript configuration](docs/MODULE_PATH_RESOLUTION.md#typescript-consumer-configuration).
The declarations provide types for document imports; the application still needs
a GraphQL document loader or build integration.

Without `--config`, the CLI searches the current directory for
`graphql-dts.config.ts`, `.mts`, `.js`, then `.mjs`, in that order.
All commands accept `--config <file>` to select a custom location. Relative paths
are resolved from the current working directory; absolute paths are accepted.

```bash
graphql-precise-dts generate --config config/graphql.ts
graphql-precise-dts check --config config/graphql.ts
graphql-precise-dts list --config /workspace/config/graphql.ts
```

`generate` publishes changed declarations and ownership manifests. `check` runs the same validation and rendering plan, compares it with the filesystem, and never creates, updates, or removes files. `list` prints configured project IDs in deterministic order.

If switching branches or generator versions changes previously generated files,
use `generate --force` to overwrite planned output files even without an ownership
manifest, and delete previously recorded files that are no longer needed:

```bash
graphql-precise-dts generate --force --config graphql-dts.config.ts
```

Without `--force`, generation rejects files modified since the last publication.
Unchanged stale files are cleaned up in either mode. Force preserves files that
are neither planned outputs nor recorded in the previous manifests, and prints
`WARNING dirty-output` with their paths. These files are not added to the new
manifests. Keep manifests to allow cleanup of obsolete generated files.
Force does not bypass compilation errors or clear the schema cache.

Schema snapshots are cached by default under `<root>/.graphql-precise-dts/cache` and invalidated by schema contents, schema semantics, generator version, GraphQL version, or cache format. Set `cache.directory` to relocate this persistent cache or `cache.enabled: false` to disable it. `check` can read a compatible cache entry but never creates or repairs one.

Execution is sequential by default. Opt into a bounded worker-thread pool with `execution: { mode: 'parallel', maxWorkers: 2 }`; `maxWorkers` is required and positive in parallel mode. Schemas still run one at a time, while independent declaration bundles for the current target may run in parallel and are collected in deterministic source order. `generate` holds fail-fast project locks under `<root>/.graphql-precise-dts/locks` until publication completes. Set `locks.directory` to relocate these locks independently of the cache. Like `cache.directory`, relative paths are resolved from `root`, and absolute paths are used directly. Concurrent generators for the same project must use the same lock directory. Lock files are removed on completion, but the directory remains; `check` does not create locks.

The same operations are available programmatically:

```ts
import {
  checkDeclarations,
  generateDeclarations,
  listProjects,
} from '@omnicajs/graphql-precise-dts'

const generation = await generateDeclarations(config)
const check = await checkDeclarations(config)
const projectIds = listProjects(config)
```

The API equivalent of `generate --force` is
`await generateDeclarations(config, { force: true })`. The option applies to one
invocation; it is not part of the saved configuration.
If undeclared files remain, the result includes `warnings`: a list of
`{ code: 'dirty-output', root, files }` records with paths relative to the
configuration root. The CLI prints them to stderr without failing generation.

## GraphQL Code Generator adapter

```bash
yarn add -D @graphql-codegen/cli @graphql-codegen/plugin-helpers
```

```ts
import type { CodegenConfig } from '@graphql-codegen/cli'
import { defineString } from '@omnicajs/graphql-precise-dts'

export default {
  schema: 'schema.graphql',
  documents: ['src/**/*.graphql'],
  generates: {
    'generated/operations.d.ts': {
      plugins: [{
        '@omnicajs/graphql-precise-dts/codegen': {
          root: 'src',
          typesModule: '@app/graphql/schema',
          enumsModule: '@app/graphql/enums',
          resolve: { alias: { '.': '@app/graphql' } },
          scalars: { DateTime: defineString() },
          naming: 'pascalCase',
        },
      }],
    },
  },
} satisfies CodegenConfig
```

The adapter returns an aggregate of document declarations. It does not publish
schema support files or a declaration tree. Supply the schema contract identified
by `typesModule` and, when needed, `enumsModule`, or generate it with the project API.

## Configuration and generated output

A schema selects scalar mappings, naming, directive policies, and optional schema
outputs. Each project target selects a schema, documents, a declaration tree,
and an optional aggregate file. Output paths are resolved from the configuration
root; document selectors are resolved from the project root.

`typesModule` identifies the schema support module imported by operation
and fragment declarations. `enumsModule` identifies a separate enum module;
when omitted, enum imports use `typesModule`.

Custom scalar mappings use structural types exported by the package root:

```ts
import {
  defineNamed,
  defineString,
  defineObject,
  defineObjectField,
} from '@omnicajs/graphql-precise-dts'

const scalars = {
  DateTime: { input: defineString(), output: defineNamed('Date') },
  Metadata: defineObject({ id: defineObjectField(defineString()) }),
}
```

Naming styles are `keep`, `pascalCase`, `camelCase`, and `snakeCase`. Use `naming`
as a style or an object with `typeNames`, `operationNames`, `fragmentNames`, and
`enumMembers`. For `ReviewState.InReview = 'IN_REVIEW'`, set
`naming: { enumMembers: 'pascalCase' }`.
Response keys, variable names, and serialized enum values are preserved.

Declaration trees contain file modules and can overlay source documents with
TypeScript `rootDirs`; aliased imports also need a `paths` fallback to the tree.
See [module resolution](docs/MODULE_PATH_RESOLUTION.md).

For clients that add unaliased `__typename` to abstract selections, use
`schemas.<id>.typename: 'abstract'` to retain discriminator-based narrowing.
The default `'optional'` does not assume a client transform; see
[typename policy](docs/DIRECTIVES.md#abstract-selections-and-typename).

Built-in `@skip` and `@include` directives affect selection presence. Custom
`directives` policies support `ignore`, `conditional`, `warn`, and the field-only
`nonnull` and `override` effects. A policy can be scoped to `field`,
`fragmentSpread`, and `inlineFragment`.

External fragments require explicit provider imports in the operation document:

```graphql
#import "../fragments/user.graphql"
query FetchUser($id: ID!) {
  payload: user(id: $id) {
    ...UserDetails
    displayName: name
  }
}
```

This operation describes `payload` and `displayName` response keys. Provider
identity belongs to its document; missing or ambiguous providers are diagnostics.

## Usage guides

- [User guide and recipes](docs/README.md)
- [Module paths](docs/MODULE_PATH_RESOLUTION.md)
- [Structural TypeScript types](docs/TYPES.md)
- [Naming](docs/NAMING.md)
- [Directives](docs/DIRECTIVES.md)
- [Schema JSDoc](docs/SCHEMA_JSDOC.md)
- [Diagnostics](docs/DIAGNOSTICS.md)
