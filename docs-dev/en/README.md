# Developer documentation

[Русский](../ru/README.md) | [All languages](../README.md)

This directory helps developers understand the generator, trace an operation
through it, and write tests for its public behavior. The user-facing API and
package configuration are documented in the [main README](../../README.md) and
the [user guide](../../docs/README.md).

## Development

Use Node.js 24 and the Yarn version declared in `package.json`. The development
compiler is TypeScript 6.0; its range stays below 6.1 while `typescript-eslint`
requires that upper bound. CI installs each matrix compiler locally and runs
type checks, runtime coverage, and built-package checks with TypeScript 5.5,
5.8, 5.9, and 6.0 on Node.js 22 and 24.

Source code lives in `src/`; public scenarios and integration checks live in
`tests/`. Declarations are generated in temporary test workspaces and compared
with committed expectations in `tests/fixtures/cases/`. `tests/cases/` separately
checks declaration contracts with TypeScript, including Apollo Client inference,
positive and negative consumer examples, schema types, and enum modules.

```bash
yarn lint:fix
yarn test
yarn test:coverage
```

`yarn test` runs public type checks, runtime scenarios, and built-package checks.
The declaration `.test-d.ts` tests in `tests/cases/` validate committed expectations
without running the generator. Public API scenarios must reproduce those same
files byte for byte. Tree and aggregate declarations use separate TypeScript projects.

| Command | Checks |
|---|---|
| `yarn test` | Types, runtime behavior, and the built package |
| `yarn test:types` | Public API types and saved declaration contracts |
| `yarn test:types:api` | Public configuration and Codegen types |
| `yarn test:types:cases` | Saved fixture declarations through isolated `.test-d.ts` projects |
| `yarn test:runtime` | Public API scenarios, fixture comparisons, and integrations |
| `yarn test:cases` | Fixture output comparisons and their static declaration contracts |
| `yarn test:package` | Build, package exports, CLI, workers, and Codegen consumers |
| `yarn test:coverage` | Runtime tests with the configured coverage thresholds |

Fixture helpers live in `tests/fixtures/`: `workspace.ts` creates disposable
copies of inputs, and `generation.ts` invokes the public API for one fixture
project. Checked-in expectations remain unchanged during every test command.
See the [testing guide](TESTING.md) for coverage scope and measurement limits.

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
included in the npm package: `package.json#files` lists `dist`, the user-facing `docs/`, `README.md`,
and `CHANGELOG.md`.

The Russian and English versions contain the same set of pages. When a contract
or the project structure changes, update both versions, including examples and
diagrams.
