# Commit Workflow
Use this skill when creating git commits in this repository. It standardizes commit splitting,
Conventional Commit type selection, optional subsystem scopes, changelog-friendly phrasing,
and commitlint constraints.

## When To Use
Use this skill when the user asks to:

- create one or more commits;
- split changes into separate commits;
- choose commit messages, types, or scopes;
- validate commit formatting before committing.

## Mandatory First Step
Before creating any commit in this repository, reread this skill from the top and treat it
as the current source of truth for commit wording, scopes, splitting, and lockfile policy.

## Required Rules
- Commit format: Conventional Commits.
- Message language: English by default.
- Subject style: describe a completed historical change, not an intention.
- Start commit subject description with an uppercase letter.
- Keep commit subject description concise.
- Put long details into the commit body; lists in body are allowed.
- Use past/perfect tense; prefer passive voice when it reads naturally for changelogs.
  Examples: Added ..., Removed ..., Refactored ..., Fixed ..., Updated ....
- Allowed types: `feat`, `fix`, `build`, `ci`, `perf`, `docs`, `refactor`, `style`, `test`, `chore`.
- Breaking-change marking is commit-wide: if at least one staged change in a commit is breaking, the commit message must
use Conventional Commit breaking syntax (`type!:` or `type(scope)!:`) and/or include a `BREAKING CHANGE:` footer.
Never leave a commit unmarked as non-breaking when it contains any breaking change.
- This repository is a single package, so scope is optional.
- Do not invent synthetic scopes just to imitate release automation.
- Breaking changes: use ! in header or a BREAKING CHANGE footer.
- Do not mix unrelated changes in one commit.
- Always commit yarn.lock changes in a dedicated commit with no other files.
- For a yarn.lock-only commit, use the exact header: chore: Updated yarn.lock.
- Do not amend or rewrite history unless explicitly requested.
- For commit tasks, use the local skill: `skills/commit-workflow/SKILL.md`.

## Workflow
1. Inspect pending changes:
```bash
git status --short
git diff
```
2. Group files by logical intent. Keep code, docs, lockfile, and generated artifacts separated when
they represent different changes.
3. If `yarn.lock` changed, split it into a dedicated commit.
4. Choose commit type and optional scope.
5. Compose the header:
```bash
<type>(<scope>): <Short description>
```
If scope is not useful, omit it:
```bash
<type>: <Short description>
```
6. Stage only the target files:
```bash
git add <files>
```
7. Create the commit non-interactively:
```bash
git commit -m "<type>(<scope>): <Description>"
```
8. Verify the result:
```bash
git show --name-status --oneline -n 1
```

## Practical Patterns
- Public API redesign: `feat!: Assertion API was redesigned around structured violations`.
- Assertion internals cleanup: `refactor(assertions): Assertion helpers were simplified`.
- Type-only adjustment: `refactor(types): Public assertion types were updated`.
- Test coverage update: `test: Assertion coverage was expanded`.
- Build/config change: `build: Vite entrypoints were updated`.
- Documentation update: `docs: README was updated`.
- Lockfile refresh: `chore: Updated yarn.lock`.
