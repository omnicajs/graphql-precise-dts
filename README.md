# graphql-precise-dts

`@omnicajs/graphql-precise-dts` is a GraphQL Code Generator plugin that generates TypeScript declaration files for GraphQL documents.

The generated declarations:

- keep fragment and operation types scoped to the corresponding `.graphql` module;
- generate `TypedDocumentNode` declarations for operations;
- emit a sibling `schema.d.ts` file with enums and scalar mappings;
- account for directives that can change the runtime response shape.

## Installation

Install the plugin together with its runtime type dependencies:

```bash
yarn add -D @graphql-codegen/cli @omnicajs/graphql-precise-dts
yarn add graphql @graphql-typed-document-node/core
```

`@graphql-typed-document-node/core` is required because generated declarations import `TypedDocumentNode` from that package.

## Usage

Example GraphQL Code Generator config:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'src/schema.graphql',
  documents: [ 'src/**/*.graphql' ],
  generates: {
    'src/generated/types.d.ts': {
      plugins: [ '@graphql-codegen/graphql-precise-dts' ],
      config: {
        prefix: '~/',
        scope: 'src/',
        relativeToCwd: false,
        scalars: {
          DateTime: 'string',
        },
      },
    },
  },
}

export default config
```

## Output

For a target like:

```txt
src/generated/types.d.ts
```

the plugin produces:

- `src/generated/types.d.ts` with `declare module '...'` blocks for GraphQL documents;
- `src/generated/schema.d.ts` with:
  - `export type Scalars = ...`
  - `export type MyEnum = ...`

Operation declarations are emitted as typed document exports:

```ts
export type GetUserQuery = ...
export type GetUserQueryVariables = Exact<...>
export const getUserQuery: TypedDocumentNode<GetUserQuery, GetUserQueryVariables>
export default getUserQuery
```

## Configuration

Supported plugin config:

```ts
type PluginConfig = {
  prefix?: string
  scope?: string
  relativeToCwd?: boolean
  scalars?: Record<string, string | { input?: string; output?: string }>
  directivePolicies?: Record<string, DirectivePolicy | DirectiveNodePolicies>
}
```

### `prefix`

Prefix prepended to generated GraphQL module ids.

### `scope`

Optional path prefix used to preserve only the scoped part of the document path in module ids.

### `relativeToCwd`

When enabled, absolute document paths are normalized relative to `process.cwd()` before generating module ids.

### `scalars`

Overrides scalar TypeScript types.

Examples:

```ts
{
  scalars: {
    DateTime: 'string',
  },
}
```

or:

```ts
{
  scalars: {
    DateTime: {
      input: 'string',
      output: 'Date',
    },
  },
}
```

## Additional documentation
- `MODULE_PATH_RESOLUTION` - [detailed path resolution rules and examples](docs/MODULE_PATH_RESOLUTION.md);
- `DIRECTIVES` - [detailed semantics, supported policy effects, and examples](docs/DIRECTIVES.md).
