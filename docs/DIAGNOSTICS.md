# Diagnostics

Generation distinguishes located document diagnostics from configuration,
schema-loading, and filesystem failures. Inspect both the API result and thrown
errors when integrating the generator.

## Project API

`generateDeclarations(config)` returns `outputs` and `diagnostics`. A diagnostic
contains `severity`, `code`, `sourceId`, `message`, an optional one-based
`location`, and schema identity. Document diagnostics also identify their project
and target.

```ts
import { generateDeclarations } from '@omnicajs/graphql-precise-dts'

const result = await generateDeclarations(config)
for (const diagnostic of result.diagnostics) {
  console.error(diagnostic.code, diagnostic.sourceId, diagnostic.message)
}
const hasErrors = result.diagnostics.some(item => item.severity === 'error')
```

If the plan contains an error diagnostic, declarations are not published.
Warnings do not prevent publication. Invalid configuration or operational
failures can throw instead of producing a document diagnostic. Publication
checks ownership before writes; writes are atomic per file, not a transaction
across all output trees.

## Diagnostic codes

| Code | Concern |
|---|---|
| `invalid-document` | Invalid operation, field, argument, directive, type condition, variable use, selection merge, cycle, or name collision |
| `invalid-document-import` | Invalid document-provider import |
| `missing-fragment-provider` | No explicit provider for an external fragment |
| `ambiguous-fragment-provider` | More than one matching provider |
| `unavailable-fragment-provider` | Provider cannot supply its declaration |
| `repeated-field-selection` | Redundant direct field selection |
| `repeated-fragment-spread` | Redundant direct fragment spread |
| `directive-warning` | Configured warning policy |
| `scalar-name-conflict` | Custom scalar reference conflicts with another name |
| `skipped-document` | Document could not be parsed for compilation |
| `unsupported-document` | Document cannot be handled as an operation/fragment bundle |
| `unsupported-schema-type` | Schema type cannot be represented by the compiler |

Always inspect `severity`; a code is an identifier, not a replacement for the
severity field. Diagnostics retain source locations when the relevant source
node is available.

## Fragment and selection contracts

External fragments require explicit document providers. A missing provider is
not recovered by choosing an arbitrary same-named fragment. Invalid schema
references and incompatible repeated selections must not yield a silently
incomplete response type.

Compatible direct repeats can be merged and diagnosed as redundant. Repeats
introduced through fragment composition must be checked for compatibility even
when they do not produce a direct-repeat warning.

## Check mode

`checkDeclarations(config)` returns diagnostics and differences without writing,
repairing caches, or cleaning output trees. Difference kinds are `missing`,
`changed`, `stale`, `modified`, and `unowned`. When compilation reports an error,
filesystem comparison is skipped; an empty differences list alone is not success.

## CLI and Codegen

CLI diagnostics go to stderr. `generate` exits with code 1 on errors and code 0
on success, including warning-only results. `check` exits with code 1 for errors
or differences. Invalid arguments and operational failures also produce a
nonzero exit code. `list` prints project IDs to stdout.

The Codegen adapter writes warnings through `console.warn` and throws an error
containing error diagnostics. GraphQL Code Generator owns writing the returned
aggregate declaration file.

See the [generation flow](../docs-dev/en/FLOW.md) and
[public testing guide](../docs-dev/en/TESTING.md).
