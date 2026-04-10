# Coverage Recovery
Use this skill when coverage is below target or when uncovered validator, predicate, runner, or build-related
paths must be analyzed and resolved with minimal artificial tests.

## When To Use
Use this skill when the user asks to:

- increase test coverage;
- analyze uncovered lines or branches;
- explain why specific uncovered paths remain;
- improve confidence around assertions, predicates, runners, or validation edge cases.

## Source Of Truth
- `AGENTS.md`;
- `vitest.config.ts`;
- `package.json`;
- `coverage/` HTML reports.

## Principles
- Coverage is a quality signal.
- Start from real public API behavior.
- Prefer fixing architecture or removing dead code over adding synthetic tests for impossible paths.
- Defensive branches should be tested with controlled failure scenarios.
- Keep type-level and runtime behavior aligned.

## Workflow
1. Collect facts:
```bash
yarn test:coverage
```
2. Read uncovered details, not only percentages. Use:
   - `coverage/index.html`;
   - `coverage/lcov-report/index.html` (if present).
3. Classify uncovered paths:
   - `real usage gap` - missed public scenario;
   - `defensive path` - malformed input or runtime failure;
   - `dead/redundant path` - likely removable;
   - `architecture smell` - design makes real testing awkward.
4. Resolve in this order:
   - add or adjust tests for real public API scenarios;
   - add controlled break/failure tests for defensive branches;
   - simplify or remove dead branches;
   - propose architecture refactor for smell cases.
   - Prefer a coverage delta summary over speculative edits: what improved, what remains, and why further additions
   would be artificial.
5. Re-run checks:
```bash
yarn lint
yarn test:coverage
```

## Controlled Failure Patterns
- Invalid values passed into assertions or runners.
- async/build pipeline failures during generation.
- Unsupported object/array shapes for recursive validators.
- Type guard mismatches between runtime checks and declared narrowing.
- Export or build-path regressions surfaced only after refactors.
- GraphQL schema resolution failures:
  unknown `typeCondition`, missing fields in selections, or a field resolved against an incompatible parent type.
- Incomplete or inconsistent GraphQL documents:
  fragment spreads pointing to missing fragments, or empty `selectionSet` structures where nested selections are required.
- Conflicting or unsupported `__typename` and polymorphic selection combinations:
  explicit `__typename` without a valid specialization path, or inline fragments targeting incompatible concrete types.
- Import and declaration rendering failures:
  missing imported fragment types, duplicated export/import names, or unstable import ordering after refactors.
- Empty registry and collection boundaries:
  no fragment definitions, no enums, no custom scalars, or empty builder/render inputs.
- Runtime model and type-level contract divergence:
  runtime output shapes that drift from `.test-d.ts` expectations or become impossible to express consistently in declarations.
- Build-to-runtime boundary regressions:
  changes that pass unit tests but break `generate` or produce invalid declaration output.

## Stop Condition
If progress stalls after reasonable attempts:
- Stop brute-force test additions.
- Stop if new tests would validate implementation details instead of stable public behavior.
- Stop if covering the branch requires mocks, inputs, or runtime states that cannot occur through supported project flows.
- Stop if the uncovered path is exercised only by generated, unreachable, or construction-impossible code.
- Stop if the remaining gap comes from tooling limitations:
  type-level tests, coverage provider behavior, or build/typecheck integration that does not reflect missing runtime confidence.
- Do not continue once additional coverage work stops increasing confidence and starts only increasing percentage.
- Report exact uncovered locations and why they are hard or non-natural.
- Offer concrete options:
   - accept remaining defensive uncovered paths;
   - refactor the implementation to make behavior testable;
   - remove redundant branches if behavior is impossible by construction.
