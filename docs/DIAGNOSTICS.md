# Diagnostics

This document describes diagnostics emitted by `@omnicajs/graphql-precise-dts` during declaration generation.

Diagnostics fall into three groups:

- warnings: generation continues, but the user should inspect the reported document or selection;
- errors: generation fails because the plugin cannot safely produce declarations;
- automatic recovery: the plugin normalizes or deduplicates compatible structures without failing generation.

## Warnings

### Skipped documents without parsed AST

If GraphQL Code Generator passes a configured document to the plugin without a parsed `document` AST, the plugin
emits a warning:

```txt
Document "broken.graphql" was skipped because no parsed GraphQL AST was provided to the plugin. Check the document for syntax errors or unsupported constructs; skipped documents are not included in generated declarations.
```

This usually means the document was discovered by the configured `documents` glob, but GraphQL parsing failed before
the plugin could inspect it.

Examples of parse-level issues include:

```graphql
query EmptySelection {
  group {
  }
}
```

```graphql
fragment MissingTypeCondition {
  id
}
```

The plugin does not receive a partial AST for these files, so it cannot generate declarations for them. Valid documents
from the same generation run are still processed.

### Missing fragment definitions

If a document references a fragment that is not present in the configured `documents` input, the plugin emits a warning:

```txt
Fragment definition "UserDetails" referenced from "user.graphql:4:9" was not found among the documents configured for the plugin.
```

The plugin does not recover missing fragments automatically. The missing definition is not synthesized.

### Repeated selections

If a selection set repeats the same field or fragment spread directly, the plugin emits a warning with the repeated
selection location and the first occurrence:

```txt
Repeated field selection "id" detected in fragment "GroupOwner" at "group.graphql:5:33". The plugin merged it, but the selection is redundant. First occurrence: "group.graphql:4:33".
```

```txt
Repeated fragment spread "OwnerFields" detected in fragment "GroupOwner" at "group.graphql:9:33". The plugin merged it, but the spread is redundant. First occurrence: "group.graphql:8:33".
```

These warnings are emitted only for direct repeats on the same selection set level. Repeats that become visible only
after flattening inline fragments can still be merged in the generated output, but they are not reported as direct
redundant selections.

### Directive warning policies

Custom directive policies with the `warn` effect emit the configured warning message while preserving the generated
shape:

```ts
directivePolicies: {
  review: { effect: 'warn', message: 'Manual review required' },
}
```

If no custom message is provided, the plugin uses a default message for the directive.

## Errors

### Missing output file

The plugin requires `info.outputFile` from GraphQL Code Generator. If it is missing, generation fails:

```txt
Output file is missing
```

### Unnamed operations

Operations must be named so the plugin can create stable declaration exports:

```graphql
query {
  user {
    id
  }
}
```

Generation fails with a diagnostic that includes the operation kind and source location:

```txt
Operation name is missing for query operation in "user.graphql:1:1". Name the operation so the plugin can generate stable declaration exports.
```

### Reserved `__typename` alias

Aliasing a non-`__typename` field to the response name `__typename` is not supported:

```graphql
fragment GroupOwner on Group {
  owner {
    __typename: id
  }
}
```

Generation fails because `__typename` is reserved for GraphQL runtime type information.

### Incompatible repeated selections

The plugin can merge compatible repeated selections, but fails when repeated selections with the same response name
target different fields, use different arguments, or produce incompatible shapes.

Example:

```graphql
fragment GroupOwner on Group {
  owner {
    name: id
    name: __typename
  }
}
```

Generation fails with a conflict diagnostic that includes both source locations and the merge reason.

```txt
Conflicting selections for response name "name" at "group.graphql:3:5" and "group.graphql:4:5": different target fields "id" and "__typename" cannot be merged.
```

### Incompatible repeated fragment spreads

Repeated fragment spreads can be merged only when they target the same fragment type information. If two spreads with
the same fragment name resolve to incompatible type information, generation fails with a conflict diagnostic.

```txt
Conflicting fragment spreads "OwnerFields" at "group.graphql:4:5" and "group.graphql:5:5" cannot be merged.
```

### Generated export name collisions

Before rendering a document bundle, the plugin validates generated declaration exports against imported types and
other generated exports.

Generation fails if two distinct declarations still resolve to the same exported name after normalization, for example:

```txt
Name collision detected in generated declaration exports for "user.graphql": "UserStatus" is used both by imported type "UserStatus" and by fragment "UserStatus".
```

## Automatic Recovery

### Compatible repeated selections are merged

Compatible repeated fields and fragment spreads are deduplicated in the generated output. This includes cases such as:

- `id` plus `id`;
- repeated fragment spreads with the same type information;
- `id` plus `... on User { id }` when the field remains compatible.

Direct repeats still emit warnings so users can clean up redundant documents.

### Generated alias names are adjusted

When repeated or recursive input/output object shapes need named aliases, the plugin allocates names that avoid
occupied imported and generated type names.

If a preferred alias is already occupied, the plugin appends a numeric suffix such as `TreeInput2`.

### Duplicate output aliases covered by imported fragments are removed

If a generated output alias only duplicates imported fragment spreads, the plugin removes the local alias and renders
references directly as the imported fragment type or imported fragment intersection.

For example, this generated alias is omitted:

```ts
export type UsersQueryPrimaryUser = UserIdentity & UserProfile
```

Usage sites are rendered directly instead:

```ts
export type UsersQueryQueryPayload = {
  __typename?: 'Query';
  primaryUser: UserIdentity & UserProfile;
  secondaryUser: UserIdentity & UserProfile;
}
```

### Duplicate fallback `__typename` rows are omitted

When root spreads already provide the same runtime type information, the plugin can omit a synthesized fallback
`__typename` row to avoid redundant output.

### Union variants can collapse to a shared shape

If all concrete variants of an abstract field render to the same selection set, the plugin collapses them into a
single object shape with a union of possible `__typename` values.

## What the Plugin Does Not Recover

The plugin does not:

- parse invalid GraphQL documents itself when no AST is provided;
- synthesize missing fragment definitions;
- guess names for unnamed operations;
- merge selections with incompatible response names, arguments, nullability, list structure, override policies, or
  nested shapes.
