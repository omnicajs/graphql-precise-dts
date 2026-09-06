# User guide

The generator has three entrypoints: the project API, the CLI, and the GraphQL
Code Generator adapter. They share configuration semantics for schema types,
operation selections, naming, scalar mappings, and directives.

Start with the [installation and project configuration](../README.md#installation).
Then configure [TypeScript module resolution](MODULE_PATH_RESOLUTION.md#typescript-consumer-configuration)
so your application can consume the emitted declarations.

| Guide | Use it to |
|---|---|
| [Module paths](MODULE_PATH_RESOLUTION.md) | Select documents, import fragments, resolve schema/enum modules, and choose tree or aggregate declarations |
| [Types](TYPES.md) | Describe custom scalars and field overrides, including different input and output shapes |
| [Naming](NAMING.md) | Name TypeScript exports while preserving GraphQL response aliases |
| [Directives](DIRECTIVES.md) | Describe conditional presence, non-null fields, and custom directive effects |
| [Schema JSDoc](SCHEMA_JSDOC.md) | Publish schema support files with enum and scalar documentation |
| [Diagnostics](DIAGNOSTICS.md) | Handle validation errors, warnings, and differences in check mode |

## Common workflows

| Task | Recipe |
|---|---|
| Generate operation types and schema support files | Configure schema `outputs` and project targets, then run `graphql-precise-dts generate` |
| Detect outdated output without changing files | Run `graphql-precise-dts check` in CI and require a zero exit code |
| Produce one operation declaration file | Configure the target's `outputs.aggregate`; include that file instead of its declaration tree in TypeScript |
| Use GraphQL Code Generator | Use the [`/codegen` adapter](../README.md#graphql-code-generator-adapter) and supply matching schema support modules |
| Diagnose unresolved imports in an editor | Check `paths` and `include` in the consumer's tsconfig; module IDs and output paths are separate settings |

Operation `.d.ts` files describe document values; they do not load or execute
GraphQL documents. The application still needs its own document loader or build
integration.

For work on this repository, see the [development commands](https://github.com/omnicajs/graphql-precise-dts/blob/main/docs-dev/en/README.md#development)
and the [developer guides in English and Russian](https://github.com/omnicajs/graphql-precise-dts/blob/main/docs-dev/README.md).
