# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.3.1](https://github.com/omnicajs/graphql-precise-dts/compare/v0.3.0...v0.3.1) (2026-06-18)


### Fixes

* Added path aliases for generated schema imports ([daf754f](https://github.com/omnicajs/graphql-precise-dts/commit/daf754f0c816ebf435edafefd9cce996810b35e1))

## [0.3.0](https://github.com/omnicajs/graphql-precise-dts/compare/v0.2.0...v0.3.0) (2026-06-17)


### ⚠ BREAKING CHANGES

* External fragment resolution now respects explicit document imports and fails when a referenced fragment is not imported, ambiguous, or imported from a document outside the configured documents.
* Generated schema support output includes schema-level type declarations and enum imports.
* Enum declarations were moved from generated schema declarations into a generated enums.ts file. Declaration imports now reference the generated enums module, and empty schema or enum artifacts are omitted.

### Features

* Added configurable schema declaration output directory ([8ba19db](https://github.com/omnicajs/graphql-precise-dts/commit/8ba19db6f02d28bd350fa4240ca47c134bf7e0e6))
* Added custom scalar name conflict warnings ([3d0c1d8](https://github.com/omnicajs/graphql-precise-dts/commit/3d0c1d863dea44c91d2aacffb32945707a71c562))
* Added generated enum output file ([978f8d1](https://github.com/omnicajs/graphql-precise-dts/commit/978f8d1140539a036ae91434429a01d8f9f32f86))
* Added schema JSDoc output ([3d01e90](https://github.com/omnicajs/graphql-precise-dts/commit/3d01e90540fc8c78849835358e64cd5b1c38d73f))
* Added schema type declaration output ([bfb1a5f](https://github.com/omnicajs/graphql-precise-dts/commit/bfb1a5f8fda3c5ff08a804791e7d6a374e721de1))


### Fixes

* Enforced explicit document import resolution ([3bc740c](https://github.com/omnicajs/graphql-precise-dts/commit/3bc740cac33f498b81017c088ecfb97a0d6b2157))
* Moved declaration helpers into schema output ([3355159](https://github.com/omnicajs/graphql-precise-dts/commit/335515926d8049d0ea4a2ebe65ddd4b1024c31f8))

## [0.2.0](https://github.com/omnicajs/graphql-precise-dts/compare/v0.1.0...v0.2.0) (2026-06-04)


### ⚠ BREAKING CHANGES

* Generated aliases were made internal
* Generated alias type names now use shape-based names with `Alias` suffixes and hash suffixes for collisions. Previously generated names such as `TreeInput`, `TreeFragmentTree`, or numeric collision variants like `TreeInput2` may now be emitted as `TreeInputAlias`, `TreeAlias`, or `TreeAlias_<hash>`.
* Generated declarations can omit previously emitted output alias types when their shape is fully covered by imported fragment spreads.

### Features

* Generated aliases were made internal ([e47b19d](https://github.com/omnicajs/graphql-precise-dts/commit/e47b19de214bf74244901b839081b653c629f76e))


### Fixes

* Added early rejection for unnamed operations ([b7cde13](https://github.com/omnicajs/graphql-precise-dts/commit/b7cde13c0fdf525e1022802f0c5156812c25fc90))
* Added warnings for skipped documents ([4805ccc](https://github.com/omnicajs/graphql-precise-dts/commit/4805cccecc6789d4e7233df6c299f179db09fbef))
* Removed duplicate aliases for imported fragments ([84a38e3](https://github.com/omnicajs/graphql-precise-dts/commit/84a38e3161bdbd5c259818df85a3158f6c4ebeab))
* Simplified generated alias naming ([37a120e](https://github.com/omnicajs/graphql-precise-dts/commit/37a120e80ceb88a10bfba0dc3e6c09a58d1c7178))

## [0.1.0](https://github.com/omnicajs/graphql-precise-dts/compare/v0.0.1...v0.1.0) (2026-05-08)


### ⚠ BREAKING CHANGES

* Nested selections merged from conditional repeated parent fields now preserve conditionality in generated output. Fields that were previously emitted as required due to incorrect merge behavior may now become optional in nested object and union shapes.
* Generated declaration export names are now validated for collisions within each emitted module. When generated aliases conflict with imported types, fragment exports, or operation payload and variables types, the plugin may either rename aliases with numeric suffixes or fail generation with a name-collision error. Projects that referenced previous generated alias names or relied on conflicting declaration output must update to the new generated names or resolve the collisions in source documents.
* Generated operation payload type names were updated
* Generated `declare module` blocks for GraphQL operations now emit exports in a different sequence than before. Now the export of variable types occurs before the types of operation results
* The public TsType helper API was renamed. Previous helper exports such as stringType, numberType, booleanType, namedType, nullType, unknownType, genericType, objectType, tupleType, literalType, and makeNullableType were replaced with defineString, defineNumber, defineBoolean, defineNamed, defineNull, defineUnknown, defineGeneric, defineObject, defineTuple, defineLiteral, and makeNullable. Object type construction was also changed from array-based field descriptors to defineObject({...}) with defineObjectField(...). Consumers must update imports and custom scalar or directive type definitions to the new helper names and object builder shape.
* Generated declaration output was restructured for repeated and recursive object shapes. Repeated or recursive input/output object shapes are now lifted into named type aliases and referenced from usage sites instead of always being rendered inline.
* Scalar type configuration now expects structural TsType helper definitions instead of plain string type mappings.
* The plugin now validates repeated selections with the same response name using explicit merge compatibility rules and fails generation when those selections are incompatible. Documents that previously generated declarations despite conflicting repeated fields, fragment spreads, arguments, nullability, or nested result shapes may now produce merge diagnostics and require query or fragment changes.
* Generated operation variable types now use custom scalar input mappings in input positions. Projects that define different input and output scalar representations will see changed TypeScript types in generated ...Variables declarations. Consumers relying on the previous output-based behavior must update their expectations and any dependent typings.

### Features

* Custom scalar input types were applied ([605cb24](https://github.com/omnicajs/graphql-precise-dts/commit/605cb2458a23be95814ebd913cf511289efd181c))
* Generated operation payload type names were updated ([2910189](https://github.com/omnicajs/graphql-precise-dts/commit/2910189bcab449eaf566bfb9e6635bebd5e343d8))
* Preserved conditional nested selection merges ([db390b5](https://github.com/omnicajs/graphql-precise-dts/commit/db390b5c86ce795d32f5738ce8c28aa3616f2919))
* Resolved declaration export name collisions ([105572c](https://github.com/omnicajs/graphql-precise-dts/commit/105572c57885d8c63916353002e3a44330f7be50))
* Selection merge diagnostics were propagated ([7268af8](https://github.com/omnicajs/graphql-precise-dts/commit/7268af8364806b3c2946811d595cdc28be9fd248))
* Structural TsType helpers were added ([762669a](https://github.com/omnicajs/graphql-precise-dts/commit/762669af319291dc12bf9b3cbbf470efddafcb64))
* Updated public TsType helper API ([6532fe1](https://github.com/omnicajs/graphql-precise-dts/commit/6532fe1efdd1f57e6ff4b9487fccaeb8897dc06b))


* Document models pipeline was extracted ([e7cb58a](https://github.com/omnicajs/graphql-precise-dts/commit/e7cb58ab85f8633e8555f62b27b97fe0f9a7f9b9))
* The export order in generated operation declaration modules was changed ([91eba02](https://github.com/omnicajs/graphql-precise-dts/commit/91eba02e89728dc7a4891aff94d952967270ffad))

### 0.0.1 (2026-04-15)


### Features

* Added GraphQL declaration generator ([ce5bcbf](https://github.com/omnicajs/graphql-precise-dts/commit/ce5bcbf3be33045868982bb515f696b84384a317))
* Added missing fragment diagnostics ([1e51458](https://github.com/omnicajs/graphql-precise-dts/commit/1e514585658b193f9a6476c1f23232fa0505101f))


### Fixes

* Abstract field typename rendering was corrected ([dcc1116](https://github.com/omnicajs/graphql-precise-dts/commit/dcc1116ec743706fc82a9a566041017565a8320c))
* Added library "rxjs" from peer dependencies @apollo/client ([78a0ef7](https://github.com/omnicajs/graphql-precise-dts/commit/78a0ef70e90bd65be42d32d6c3ee8d983055e47d))
* Input optionality was preserved separately from nullability ([b836014](https://github.com/omnicajs/graphql-precise-dts/commit/b8360148337c3f8985aac020f387c866090353fa))
* Module path resolution was stabilized ([2a591f7](https://github.com/omnicajs/graphql-precise-dts/commit/2a591f76a0f1e65450be4e2361bc19f3254a8479))
* Nested interface selections were specialized consistently ([55d8fb2](https://github.com/omnicajs/graphql-precise-dts/commit/55d8fb2bce648704b7a6efbce9afa16377ec34b5))
* Refined __typename alias handling ([c8ae01e](https://github.com/omnicajs/graphql-precise-dts/commit/c8ae01ee5037349a72e7a385d77a938447b1639a))
* Skipped Exact for variableless operations ([c4aa800](https://github.com/omnicajs/graphql-precise-dts/commit/c4aa8000e43e47a1a042b52f14977b630be7abf4))
