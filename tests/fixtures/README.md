# Experimental fixtures

Each directory under `cases/` is a self-contained scenario. Schemas are owned by
`schemas/<schema-project-id>/`, while GraphQL documents are owned by
`projects/<operation-project-id>/documents/`.

| Case | Contract covered |
|---|---|
| `single-schema-project` | Full-sized standard project with one schema, one operation project and an executable aggregate golden |
| `shared-schema` | Two operation projects share one schema; the shell project provides the variables-and-arguments golden output |
| `multiple-schemas` | Isolated schemas with repeated paths and operation names, plus golden outputs for the first public generation slice |
| `multi-schema-project` | One project compiles independent `core` and `analytics` targets against different schemas and output trees |
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

The legacy source under `tests/fixtures/` stays unchanged. New expectations and
scenario-specific data belong only to this experimental tree.

Within `single-schema-project`, `expected/generated/` remains the byte-for-byte
copy of the original generated output. `expected/experimental/types.d.ts` is the current operation
generator contract: it keeps the legacy module namespace through
`resolve.alias`, while retaining the experimental compiler's more precise
abstract-fragment intersections. Schema and enum declarations remain external
schema contracts and are not emitted by this scenario.
