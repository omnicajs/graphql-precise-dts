# graphql-precise-dts

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

Create `graphql-precise-dts.config.ts`:

```ts
import { defineConfig } from '@omnicajs/graphql-precise-dts'

export default defineConfig({
  root: import.meta.dirname,
  cache: { directory: '.cache/graphql-precise-dts' },
  execution: { mode: 'sequential' },
  schemas: {
    core: {
      file: 'schema.graphql',
      typesModule: '@app/graphql/schema',
      outputs: {
        root: 'generated/schema',
        types: 'schema.d.ts',
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

All commands accept `--config <file>`. `generate` publishes changed declarations and ownership manifests. `check` runs the same validation and rendering plan, compares it with the filesystem, and never creates, updates, or removes files. `list` prints configured project IDs in deterministic order.

Schema snapshots are cached by default under `<root>/.graphql-precise-dts/cache` and invalidated by schema contents, schema semantics, generator version, GraphQL version, or cache format. Set `cache.directory` to relocate this persistent cache or `cache.enabled: false` to disable it. `check` can read a compatible cache entry but never creates or repairs one.

Execution is sequential by default. Opt into a bounded worker-thread pool with `execution: { mode: 'parallel', maxWorkers: 2 }`; `maxWorkers` is required and positive in parallel mode. Schemas still run one at a time, while independent declaration bundles for the current target may run in parallel and are collected in deterministic source order. `generate` holds fail-fast project locks under `<root>/.graphql-precise-dts/locks` until publication completes.

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
as a style or an object with `typeNames`, `operationNames`, and `fragmentNames`.
Response keys, variable names, and other runtime GraphQL keys are preserved.

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

## Documentation and development

Source code lives in `src/`; public scenarios and integration checks live in
`tests/`. Declarations are generated in temporary test workspaces and compared
with committed expectations in `tests/fixtures/cases/`.

```bash
yarn lint:fix
yarn tests
yarn test:coverage
```

`yarn tests` runs public type checks, runtime scenarios, and built-package checks.
`yarn test:types`, `yarn test:units`, and `yarn test:package` run these groups
individually. See the testing guide for coverage scope and measurement limits.

- [Developer documentation: English / Русский](docs-dev/README.md)
- [Module paths](docs/MODULE_PATH_RESOLUTION.md)
- [Structural TypeScript types](docs/TYPES.md)
- [Naming](docs/NAMING.md)
- [Directives](docs/DIRECTIVES.md)
- [Schema JSDoc](docs/SCHEMA_JSDOC.md)
- [Diagnostics](docs/DIAGNOSTICS.md)

## Acknowledgements

The selection-model design and response-type conventions build on Tatyana's
original generator and its accumulated consumer requirements. The repository
history retains the original implementation and authorship.
