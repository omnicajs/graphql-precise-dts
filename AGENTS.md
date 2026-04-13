# AGENTS.md

## Goals
- Avoid clarification loops by proposing a concrete interpretation when details
  are missing.
- Default to the language of the user's initial message unless they explicitly
  request a different language.
- Match the tone and formality of the user's initial message unless they
  explicitly ask for a change.
- Treat a language switch in the user's message as an explicit request to
  respond in that language.
- If a message is mixed-language, reply in the dominant language unless the
  user specifies otherwise.
- Run `yarn check:peer-deps:fix` after installing packages.
- After a series of code edits, run `yarn lint:fix` before handing off or preparing commits.
- Run `yarn tests` before handoff or commit preparation when changed files can affect
  runtime behavior.
- Run `yarn test:types` and `yarn test:units` if the changes do not affect the generated output of the plugin.
- Do not edit generated artifacts under `dist/` or reports under `coverage/` unless the task explicitly requires it.

## Reporting
- Keep handoff reports natural and outcome-focused: describe what was done.
- Do not proactively list skipped optional checks unless the user explicitly asks.
- Always mention blockers, failed required checks, or other omissions that can
  affect correctness, safety, or reproducibility.

## Purpose
This file defines practical instructions for working in the `omnicajs/graphql-precise-dts`
repository, with a focus on developing a plugin that generates TypeScript type declaration files
for the corresponding GraphQL operations.

## Repository Structure
- This project is a single-package TypeScript library.
- Package name: `@omnicajs/graphql-precise-dts`.
- Main source directories:
  - `src/` - runtime implementation;
  - `tests/` - vitest test suite;
  - `tests/types` - type-level testing;
  - `tests/units` - unit testing.
- Coverage output directory: `coverage/`.

## Local Environment Prerequisites
- Install dependencies with:
```bash
yarn install
```
- Check peer dependencies:
```bash
yarn check:peer-deps
yarn check:peer-deps:fix
```

## Running Checks

### Main Scripts
- Lint:
```bash
yarn lint
yarn lint:fix
```
- Launching the plugin with test code generation:
```bash
yarn generate:test-fixtures
```
- Type-level tests:
```bash
yarn test:types
```
- Unit tests:
```bash
yarn test:units
```
- Type-level and unit tests:
```bash
yarn tests
```
- Coverage:
```bash
yarn test:coverage
```

### Suggested Validation Order For Code Changes
```bash
yarn lint
yarn tests
yarn test:coverage
```

## Important Project Rules
- Commit messages follow Conventional Commits.
- Before creating any commit, always reread `skills/commit-workflow/SKILL.md` and
  follow it as the source of truth for commit splitting, wording, scopes, and
  lockfile policy.

## Local Skills
- `skills/commit-workflow/SKILL.md` - rules for splitting changes into commits and
  writing changelog-friendly Conventional Commit messages.
- `skills/coverage-recovery/SKILL.md` - workflow for analyzing uncovered code paths
  and improving test coverage without adding artificial tests.
- `skills/yarn-lock-conflict-resolution/SKILL.md` - safe procedure for resolving
  yarn.lock conflicts during merge or rebase.
