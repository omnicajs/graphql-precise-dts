# GraphQL fixtures

Each directory under `cases/` is a self-contained scenario. Schemas are owned by
`schemas/<schema-project-id>/`, while GraphQL documents are owned by
`projects/<operation-project-id>/documents/`.

The sibling helpers `workspace.ts` and `generation.ts` are test infrastructure.
`workspace.ts` copies `cases/` into a disposable workspace and reads expectations
from their committed locations. `generation.ts` invokes the public generator for
a single fixture project and returns its declarations and diagnostics.

| Case | Contract covered |
|---|---|
| `single-schema-project` | Full-sized standard project with one schema, one operation project and an executable aggregate golden |
| `shared-schema` | Two operation projects share one schema; the shell project provides the variables-and-arguments golden output |
| `multiple-schemas` | Isolated schemas with repeated paths and operation names, plus golden outputs for the first public generation slice |
| `multi-schema-project` | One project compiles independent `core` and `analytics` targets against different schemas and output trees |
| `abstract-fragment-narrowing` | Covariant abstract selections narrow parent and nested results to the concrete type |
| `conditional-fragment` | Conditional fields across direct, composed, transitive, and abstract fragments |
| `fragment-variables` | Variables used by imported fragments and operation/fragment name overlap |
| `fragment-heavy` | Transitive and shared fragments plus several definitions owned by one physical source |
| `fragment-providers` | Explicit fragment-provider identity, local ownership and duplicate names across source modules |
| `abstract-selections` | Interfaces, unions, aliases, variables, directives and custom scalars |
| `literal-arguments` | Nested input-object, list, enum and scalar literals on fields and directives |
| `input-values` | Variable defaults, variables nested in values, recursive inputs and oneOf inputs |
| `custom-naming` | Independent naming styles for schema types, operations and fragments |
| `repeated-selections` | Compatible repeated fields, nested selection merging and conditionality |
| `selection-composition` | Concrete variants and repeated selections composed across inline and named fragments |
| `scalar-mappings` | Directional and rich custom scalar types, TypeScript consumption and prototype-property scalar names |
| `naming-boundaries` | Shorthand naming policies, preserved names, acronym runs, derived suffixes and punctuation-only operation names |
| `name-collisions` | Generated schema, import, fragment, operation type and runtime export name collisions |
| `publication` | Atomic declaration writes, ownership manifests and safe stale-output cleanup |
| `schema-contract` | Emitted schema types, enums and aggregate operation declarations, compiled by a real TypeScript consumer |
| `diagnostics` | Located errors, non-blocking warnings and directive-policy behavior through filesystem inputs |
| `cli` | TypeScript config discovery plus `generate`, read-only `check`, `list` and warning exit behavior |

All fixture inputs live under `cases/`. `single-schema-project` reuses the
original documents and schema without changes; the duplicate top-level fixture
files were removed after a byte-for-byte comparison.

Within `single-schema-project`, `expected/generated/*.txt` preserves the original
schema, enum, and operation reference byte for byte as historical text.
`expected/app/`, `expected/schema.d.ts`, `expected/enums.ts`, and
`expected/aggregate.d.ts` form the active declaration expectations. The
`~tests/fixtures/documents` strings are module IDs, not filesystem dependencies.

## Declaration contract checks

Every fixture that produces declarations has checked-in outputs and scoped
TypeScript configurations. `tests/cases/<case>/*.test-d.ts` proves their consumer
contracts without invoking the generator. The compiler checks all active
expectations with `skipLibCheck: false` and real dependency types. Cases with
conflicting module names use separate projects. The original Apollo Client
assertions run against both the saved tree and aggregate outputs.

`tests/cases/expectations.test.ts` generates files in disposable workspaces and
compares their contents and complete inventory with the same expectations. It
also checks diagnostic expectations. `name-collisions` deliberately rejects
schema publication and has explicit rejection tests instead of declaration
artifacts. The inventory guard prevents silently omitting a fixture set or an
active `.ts` expectation.

Ordinary tests never update expectations. Edit them deliberately and review them
with the corresponding positive and negative consumer assertions. Historical
`.txt` references are not executable expectations.

Run all declaration cases with `yarn test:cases`, or only their static Vitest type
tests with `yarn test:types:cases`. They are included in `yarn test:types` and the
complete `yarn test` command. IDE resolution needs no preliminary generation.
