# Writing tests

[Русский](../ru/TESTING.md) | [All languages](../README.md)

## Core rule: public API only

Project behavior must be tested exclusively through public entrypoints. A test
must supply a supported external input or a realistically possible invalid
input and assert an observable result. Do not call internal functions directly,
construct intermediate models, or replace internal modules just to reach a
particular line in a coverage report.

This rule establishes reachability: when a scenario enters through a public API
and executes a branch, that branch has a path from real generator usage. Calling
`compileSelectionSet`, `createPlan`, or `renderDocument` directly only proves
that a function works with manually supplied arguments. It does not prove that
the generator can produce those arguments.

Exporting a function from an internal file does not make it public API. Package
exports and the CLI define the boundary, not whether TypeScript can access a
path. An existing test of an internal function is not a reason to repeat that
approach.

## Choosing a public entrypoint

| Contract under test | Test entrypoint | Observable result |
|---|---|---|
| Generation, schemas, documents, paths, cache, and publication | `generateDeclarations` from the package root | `outputs`, `diagnostics`, file contents and state |
| Checking freshness without writes | `checkDeclarations` | `differences`, diagnostics, and no disk changes |
| Configuration, project listing, and scalar mapping DSL | Corresponding package root exports | A public value, type, or error |
| Commands and configuration loading | CLI launched as a separate process | Exit code, stdout/stderr, and files |
| Codegen integration | Plugin from `./codegen`; real Codegen for framework integration | Aggregate output, diagnostics, and external tool behavior |
| ESM/CJS, package exports, and workers | Built package entrypoints | Successful use by a real consumer |

In repository tests, `@/index` is allowed as the source entrypoint for the
package root. For the adapter, `@/integrations/codegen` is allowed as the source
entrypoint corresponding to the built `./codegen` export. This does not permit
imports from other files in `src/`.

Test the CLI as a command, not by calling `runCli` directly with an artificial
environment. Test real worker processes through the built package API with
`execution.mode: parallel`, without directly invoking an internal handler.

Public API testing does not mean that every test must generate an entire project:
a public `TsType` constructor can be tested independently when its contract is
the subject. For GraphQL compilation rules, inputs remain SDL, documents, and
configuration.

## Writing a scenario

1. State the observable rule. For example: “root and nested field aliases become
   response property names.”
2. Choose the public entrypoint through which a user encounters that behavior.
3. Prepare a minimal valid schema, document, and configuration. For a negative
   scenario, violate only the constraint being tested; other inputs must remain
   valid so execution does not stop earlier.
4. For a bug fix, first obtain a reproducible failing test against the existing
   behavior. The failure must concern the contract, not broken setup.
5. Assert the result, significant things that must be absent, and side effects.
6. When generated types change, add a real TypeScript consumer with both valid
   and invalid values.
7. After the fix, check adjacent states and compositions, then coverage.

A test name describes a promise to the user: “preserves the published tree when
a document fails,” not “enters catch” or “covers branch three.”

## Example: aliases through generation

This scenario uses a temporary directory and the public API. It checks property
names in the returned declaration and verifies that the published file matches
the result.

```ts
import { expect, test } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { defineConfig, generateDeclarations } from '@/index'

test('uses aliases for root and nested response properties', async () => {
    const root = mkdtempSync(join(tmpdir(), 'graphql-aliases-'))

    try {
        writeFileSync(resolve(root, 'schema.graphql'), `
            type Query { user: User! }
            type User { id: ID!, name: String! }
        `)
        writeFileSync(resolve(root, 'user.graphql'), `
            query FetchUser {
                payload: user { userId: id, displayName: name }
            }
        `)
        const result = await generateDeclarations(defineConfig({
            root,
            schemas: {
                main: {
                    file: 'schema.graphql',
                    typesModule: '@fixture/schema',
                },
            },
            projects: {
                app: {
                    root: '.',
                    targets: {
                        main: {
                            schema: 'main',
                            documents: { files: ['user.graphql'] },
                            outputs: { tree: { root: 'generated' } },
                        },
                    },
                },
            },
        }))

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
        const output = result.outputs[0]!
        expect(output.content).toContain('payload: {')
        expect(output.content).toContain('userId: string;')
        expect(output.content).toContain('displayName: string;')
        expect(output.content).not.toMatch(/\b(user|id|name)\??:/)
        expect(readFileSync(resolve(root, output.file), 'utf8')).toBe(output.content)
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})
```

To check assignability for these declarations, add a TypeScript consumer: the
correct shape with `payload` must be accepted, while a shape containing only
`user` must be rejected. A string assertion checks property spelling but does
not prove the complete type contract.

## What to assert

### Declaration text and the TypeScript contract

A golden file is useful for the complete output: exports, imports, names,
nullability, optionality, and nested shape. Read and review the expectation
manually. Do not update it merely because the generator produced different text,
and do not compute expected output using the same algorithm being tested.

Compiling generated `.d.ts` files confirms syntax and type resolution, but even
`any` can compile successfully. A consumer must check both sides:

- valid response data and variables are accepted;
- invalid data is rejected: a missing required property, incorrect nullable/list
  nesting, a wrong alias, or an incompatible concrete type;
- narrowing by `__typename` exposes fields only for the corresponding variant.

Use a targeted `@ts-expect-error` for negative examples. Do not suppress consumer
errors with broad casts, `any`, or settings that hide errors in generated
declarations. Verify that the consumer file is actually included in compilation.
A single string assertion or the absence of an exception is not a substitute.

### Errors and filesystem effects

Assert the diagnostic code, severity, source, and location when they are part
of the scenario's contract. For input errors that reject an API call, assert
the rejection. Distinguish a warning that allows publication from an error that
blocks it.

Publication scenarios must check actual files. For example: run a successful
`generate`, make a document invalid, call `generate` again, and verify that the
tree still matches the last successful publication. Returned `outputs` do not
prove a disk write occurred. When checking failures, remember that cache and
locks have their own lifecycle.

For `check`, assert differences and the absence of writes, including cache and
manifests. For repeated generation, check deterministic text and manifests, and
preserved timestamps for unchanged files when these are the scenario's subject.

### Preparing data and failures

Use a separate temporary directory for each isolated scenario or independent
group. Remove it in `finally` or test cleanup. Copy fixtures before generation:
tests must not modify source expectations, depend on other tests' order, or
leave files in the checkout.

You may create input files, modify a previously published file, or corrupt a cache
created by a real run, then call the public API again. These are real external
states. Do not manually create `SchemaSnapshot`, `CompiledDocument`, or
`PlannedDocument` and pass them to internal execution code.

Do not mock the compiler, planner, renderer, internal indexes, or their return
values. For system failures, prefer reproducible filesystem conditions or a
separate process. Controlled replacement of an external system operation is
allowed only to simulate a real failure at that boundary: the entrypoint remains
public, the internal path runs fully, and the scenario's limitation is stated
explicitly. A mock must not create a state that the generator's design forbids.

## 100% coverage is the mandatory minimum

Accepting a change requires **100% statements, branches, functions, and lines**
in the generator's measured executable code.
[vitest.config.ts](../../vitest.config.ts) defines measurement and thresholds;
they must cover all executable generator code under `src/**`. Run
`yarn test:coverage` to produce the report. Do not present one subsystem's
coverage as coverage of the entire generator.

Review the report together with the measured file list, source maps, and
exclusions, not just the `All files` row. A successful exit code and a visually
rounded percentage do not replace inspection of uncovered code. Do not lower
the threshold to finish a task.

The metrics answer different questions:

| Metric | What the coverage map records |
|---|---|
| Statements | Which measured statements executed |
| Branches | Which measured branching alternatives executed |
| Functions | Which measured functions were called |
| Lines | Which measured lines executed |

With public entrypoints as the only test inputs, this coverage provides minimum
evidence that measured code is reachable with the test data. It **does not prove**
that assertions detect wrong results, all requirements are implemented, or all
input combinations have been checked. A validation rule missing from the
implementation does not even create an uncovered line.

### State coverage is broader than statement coverage

Statement coverage says “this statement executed.” State coverage asks a
different question: “in which system states and input combinations did it execute,
and was behavior checked in those states?” In this guide, a state means data
and execution conditions relevant to the contract, not just a position in source
code.

For example, the same selection-merging code can execute for:

- two direct fields, a field and a named fragment, or two nested fragments;
- required and conditional occurrences in different orders;
- an object, interface, or union with different concrete types;
- nullable values and lists with nullable items;
- identical aliases with compatible or conflicting arguments.

Separate tests of each feature may execute every statement and branch without
checking their interaction: for example, a conditional fragment within an
abstract selection that overlaps an unconditional nested field. Branch coverage
also does not count every combination of branches, their execution sequences,
or the data values on those paths.

Coverage maps can quantify statement coverage within the instrumentation scope.
Full state coverage first requires defining the entire reachable state space
and the metric's denominator. GraphQL document depth, values, fragment graphs,
filesystem change sequences, and concurrent event ordering make this space
impractical to enumerate; without explicit bounds, it may be infinite. A V8
report cannot provide a percentage for “all states covered.”

Maintain an explicit matrix of meaningful states and transitions in addition
to coverage. Choose equivalence classes, boundaries, and risky intersections;
do not mechanically multiply every parameter. Preserve the concrete combination
behind each discovered regression as a public scenario.

| Area | Example states and transitions |
|---|---|
| Selections | Alias × repetition × conditionality × fragment × concrete type |
| Inputs | Nullable/list × default × recursion × oneOf × scalar mapping direction |
| Fragments | Local / imported / ambiguous / unavailable provider; transitive dependencies and cycles |
| Publication | No tree → generate → repeat generate → change input → check → generation error |
| Ownership | Owned / unowned / modified / stale file; multiple targets sharing an output root |
| Execution | Cold / warm / corrupt / disabled cache; sequential / real workers |

The state matrix supplements mandatory 100% coverage; it does not replace it.

### Handling an uncovered branch

1. Find a path from the public API and a minimal external scenario that reaches
   the branch. Assert the result, not just that a call occurred.
2. If an input is rejected earlier, inspect the contract: the branch may duplicate
   an already established invariant and should not exist.
3. If the state is impossible by construction, remove the redundant branch or
   express the invariant in types. Do not bypass it by casting an intermediate
   model in a test.
4. If the branch is reachable only in another mode, test that mode through its
   public entrypoint and provide separate measurement or merged coverage maps.
5. If evidence is insufficient, record the uncovered behavior as unfinished work.
   Testing difficulty does not waive the requirement.

Do not add `ignore`, narrow `include`, or exclude a module to obtain a passing
percentage. Excluded code leaves the denominator; it does not become covered.
Document technical measurement limitations with the exact code region and a
separate public scenario. Until measurement is confirmed, do not claim full
coverage for that region. A defensive exception is not automatically unreachable
just because reproducing it is inconvenient.

## Where to put scenarios and how to run checks

Public API scenarios live in `tests/scenarios/`, generated declaration contract
tests in `tests/cases/`, fixtures in `tests/fixtures/cases/`, and integrations
in `tests/integrations/`. Group a
scenario by its observable contract — generation, configuration, diagnostics,
filesystem, or execution — rather than by an internal module's name.

Fixture helpers live in `tests/fixtures/`: `workspace.ts` owns disposable copies
and reads saved expectations, while `generation.ts` calls the public generator
for a single fixture project. Reuse these helpers in scenarios to keep temporary
workspace ownership and public API calls consistent.

Configuration type checks use `*.test-d.ts`. Consumers of generated declarations
are compiled by real TypeScript. Built-package checks, including ESM/CJS and the
worker runtime, live in `tests/package*`.

For changes to behavior or generated output, the required validation run is:

```bash
yarn lint:fix
yarn test
yarn test:coverage
```

Use `yarn test:types` for public configuration and declaration type checks,
`yarn test:cases` for all declaration cases, `yarn test:types:cases` for their
`.test-d.ts` projects, and `yarn test:package` for built entrypoints. During local work, limit Vitest to the relevant scenario file,
while retaining the complete validation run before handoff. The full `yarn test`
command includes type checks, runtime scenarios that generate declarations in
temporary workspaces, and package checks. [package.json](../../package.json) defines the commands, and
[AGENTS.md](../../AGENTS.md) defines change requirements.

`yarn test:types:api` checks only the public configuration and adapter types;
`yarn test:runtime` runs all runtime tests. `test:coverage` runs that runtime
suite with coverage thresholds, while `test:package` builds and verifies the
published entrypoints. Script groups in `package.json` are build, lint, tests,
dependency checks, and releases.

Declaration tests have two independent obligations:

1. `tests/cases/<case>/*.test-d.ts` validate the checked-in expectations in
   `tests/fixtures/cases/<case>/expected/`, including valid values, counterexamples,
   schema/enum contracts, and inference through real `TypedDocumentNode` types.
2. `tests/cases/expectations.test.ts` calls the public generator in temporary
   workspaces and compares every published file byte for byte with the same
   expectations. The inventory check requires an explicit contract for every
   fixture set and every active declaration artifact.

Tests never regenerate their expectations. Changes to expectations must be
intentional and reviewed alongside their consumer assertions. A fixture that
must reject generation, such as `name-collisions`, has explicit runtime rejection
checks instead of a fictitious declaration type test.

`vitest.cases.config.ts` discovers static projects without invoking the generator.
Each fixture has a scoped `tsconfig.json` (or `tsconfig.<target>.json`), with a
matching configuration beside its `.test-d.ts` files. They share
`tests/cases/tsconfig.base.json`, use `skipLibCheck: false`, resolve schema and enum
modules to saved files, and use the installed dependency declarations. PhpStorm
can therefore resolve the contracts immediately after checkout and dependency
installation. No generated cache or test preparation is needed.

The `single-schema-project` retains the original Apollo Client query, mutation,
subscription, variable, and fragment assertions. Its tree and aggregate projects
check the same consumers against separate saved declaration sets. Equivalent
intersection shapes are checked in both assignability directions; negative
examples use `@ts-expect-error`. The root configuration typecheck excludes these
consumers; `yarn test:types` runs both public API and fixture contract checks.

To add a declaration case, provide its inputs, saved outputs and diagnostic
expectations, register its public configuration in `tests/cases/catalog.ts`, add
scoped tsconfigs and `.test-d.ts` contracts, and run `yarn test:cases`. Include
counterexamples that would fail if the intended field, nullability, union, alias,
or variable contract were weakened. Compilation alone does not prove these
semantic expectations.

### Measurement boundaries

The report must reflect execution through the declared public boundary. Calling
`runCli` directly does not replace launching the command, even if it executes
the same lines.

When running from source, `parallel` may use a queue without the worker runtime.
Real workers are checked through the built package. Vitest coverage maps are
not automatically merged with the separate processes in `tests/package*`; a
package smoke test does not imply measured worker-code coverage. Source code
also contains `v8 ignore` annotations with explanations. Account for these
exclusions when evaluating evidence: 100% in the report refers to its measured
scope. The executable bootstrap in `src/cli.ts` is also outside the Vitest
map and is exercised by `tests/package-entrypoints.mjs`. The coverage filter
preserves that boundary; it does not prove numeric coverage of the bootstrap.

## Test readiness check

Before handing off a change, verify that:

- the entrypoint is public and the data represents a real scenario;
- the regression was reproduced and expectations come from the contract;
- assertions distinguish the correct result from materially incorrect shapes;
- the TypeScript consumer checks both valid and invalid data;
- filesystem effects and the absence of unwanted changes are checked where they
  are part of the contract;
- the measured scope meets the mandatory 100% threshold, and its contents and
  exclusions have been reviewed;
- risky state combinations are checked independently of a passing coverage map.

When reporting readiness, name the behavior proved and the remaining measurement
limitations. The percentage alone is not proof that the generator is correct.

## File-module consumer contracts

The `module-overlay`, `module-names`, and `client-typename` cases protect separate
output trees, relative and alias resolution, fragment defaults, local export-name
collisions, interfaces without implementations, enum-member casing, and abstract
narrowing. Their saved `.d.ts` files are independent oracles: type tests validate
them, then the public generator reproduces every file byte for byte. Aggregate
oracles have separate tsconfigs so they cannot supply missing tree imports.
