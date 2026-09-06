# Developer documentation

[Русский](../ru/README.md) | [All languages](../README.md)

This directory helps developers understand the generator, trace an operation
through it, and write tests for its public behavior. The user-facing API and
package configuration are documented in the [main README](../../README.md).

## Reading order

1. [ARCHITECTURE.md](ARCHITECTURE.md) — components, data models,
   responsibilities, and invariants.
2. [FLOW.md](FLOW.md) — generation from source files to TypeScript declarations,
   diagnostics, and output files.
3. [TESTING.md](TESTING.md) — writing tests through the public API, proving
   behavior, and interpreting the 100% coverage requirement.

## Using this documentation

Public entrypoints are defined by `package.json#exports`, `package.json#bin`,
and the [build configuration](../../vite.config.ts). Their implementation lives
in `src/`. These documents describe the public contracts, internal models, and
execution flow of the generator.

Update `ARCHITECTURE.md` when a module's responsibility changes, and `FLOW.md`
when execution order or results change. Rules for selecting scenarios,
assertions, and coverage evaluation belong in `TESTING.md`.

Internal functions and structures are listed to help navigate the code. They
do not become public contracts or valid test entrypoints. `docs-dev/` is not
included in the npm package: `package.json#files` lists only `dist`, `README.md`,
and `CHANGELOG.md`.

The Russian and English versions contain the same set of pages. When a contract
or the project structure changes, update both versions, including examples and
diagrams.
