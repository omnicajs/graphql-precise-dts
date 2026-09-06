import {
    afterAll,
    describe,
    expect,
    test,
} from 'vitest'

import {
    type DirectivePolicies,
    type ScalarMappings,
    checkDeclarations,
    defineConfig,
    defineGeneric,
    defineNamed,
    defineString,
    generateDeclarations,
} from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import {
    existsSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
    join,
    resolve,
} from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root
const documentsRoot = mkdtempSync(join(tmpdir(), 'graphql-precise-dts-diagnostics-'))

afterAll(() => {
    fixtureWorkspace.dispose()
    rmSync(documentsRoot, { force: true, recursive: true })
})

const generate = async (
    source: string,
    options: {
        scalars?: ScalarMappings
        directives?: DirectivePolicies
        additionalDocuments?: ReadonlyArray<string>
        alias?: Readonly<Record<string, string>>
        schemaFile?: string
    } = {}
) => {
    const files = [ 'document-0.graphql' ]
    writeFileSync(resolve(documentsRoot, 'document-0.graphql'), source)

    for (const [ index, document ] of (options.additionalDocuments ?? []).entries()) {
        const file = `document-${index + 1}.graphql`
        writeFileSync(resolve(documentsRoot, file), document)
        files.push(file)
    }

    const result = await generateDeclarations(defineConfig({
        root: resolve(fixturesRoot, 'diagnostics'),
        resolve: { alias: options.alias },
        schemas: {
            core: {
                file: options.schemaFile ?? 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
                scalars: options.scalars,
                directives: options.directives,
            },
        },
        projects: {
            diagnostics: {
                root: documentsRoot,
                targets: {
                    core: {
                        schema: 'core',
                        documents: { files },
                        outputs: { tree: { root: 'generated/diagnostics' } },
                    },
                },
            },
        },
    }))

    return {
        raw: result,
        outputs: result.outputs.map(({ sourceId, content }) => ({ sourceId, content })),
        diagnostics: result.diagnostics.map(diagnostic => ({
            severity: diagnostic.severity,
            code: diagnostic.code,
            sourceId: diagnostic.sourceId,
            message: diagnostic.message,
        })),
    }
}

describe('experimental generation diagnostics through the public API', () => {
    test('publishes declarations while reporting repeated selections as located warnings', async () => {
        const result = await generate(`
            fragment UserFields on User {
                id
            }

            query Repeated($id: ID!) {
                node(id: $id) {
                    ... on User {
                        id
                        id
                        ...UserFields
                        ...UserFields
                    }
                }
            }
        `)

        expect(result.outputs).toHaveLength(1)
        expect(result.raw.diagnostics).toMatchObject([
            {
                severity: 'warning',
                code: 'repeated-field-selection',
                sourceId: 'document-0.graphql',
                location: { line: 10, column: 25 },
            },
            {
                severity: 'warning',
                code: 'repeated-fragment-spread',
                sourceId: 'document-0.graphql',
                location: { line: 12, column: 25 },
            },
        ])
        expect(result.raw.diagnostics[0]?.message).toContain('first occurrence is at 9:25')
        expect(result.raw.diagnostics[1]?.message).toContain('first occurrence is at 11:25')
    })

    test('merges repeated list fields when their complete return types match', async () => {
        const result = await generate(`
            query RepeatedList {
                users(ids: ["one"]) { id }
                users(ids: ["one"]) { score }
            }
        `)

        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).toContain('id: string;')
        expect(result.outputs[0]?.content).toContain('score: number;')
        expect(result.raw.diagnostics).toMatchObject([{
            severity: 'warning',
            code: 'repeated-field-selection',
            sourceId: 'document-0.graphql',
        }])
    })

    test('merges a covariant composite field selected through an interface and its subtype', async () => {
        const result = await generate(`
            query CovariantComposite($id: ID!) {
                node(id: $id) {
                    child { id }
                    ... on User {
                        child { score }
                    }
                }
            }
        `)

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).toContain(
            'child: {\n\t\t\t__typename?: \'User\';\n\t\t\tid: string;\n\t\t\tscore: number;'
        )
    })

    test('merges two conditional composite selections without requiring either branch', async () => {
        const result = await generate(`
            query ConditionalComposite($identity: Boolean!, $score: Boolean!) {
                user(id: "one") @include(if: $identity) { id }
                user(id: "one") @include(if: $score) { score }
            }
        `)

        expect(result.diagnostics).toMatchObject([{
            severity: 'warning',
            code: 'repeated-field-selection',
            sourceId: 'document-0.graphql',
        }])
        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).toContain(
            'user?: {\n\t\t__typename?: \'User\';\n\t\tid?: string;\n\t\tscore?: number;'
        )
    })

    test('counts a variable used only by a statically skipped fragment spread', async () => {
        const result = await generate(`
            query SkippedFragmentVariable($id: ID!) {
                date
                ...UserById @skip(if: true)
            }

            fragment UserById on Query {
                node(id: $id) { id }
            }
        `, {
            scalars: { Date: defineString() },
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).not.toContain('& UserById')
    })

    test('prunes a statically skipped field inside a retained fragment', async () => {
        const result = await generate(`
            query PrunedFragmentSelection {
                ...Fields
            }

            fragment Fields on Query {
                __typename
                user(id: "one") @skip(if: true) { id }
            }
        `)

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).not.toContain('user:')
    })

    test('keeps a fragment that applies only to one concrete subtype', async () => {
        const result = await generate(`
            query NarrowFragment($id: ID!) {
                node(id: $id) {
                    ...UserOnly
                }
            }

            fragment UserOnly on User {
                score
            }
        `)

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
        expect(result.outputs[0]?.content).toContain('__typename?: \'Group\';')
        expect(result.outputs[0]?.content).toContain('& UserOnly')
    })

    test('skips an unparseable document without blocking valid declarations', async () => {
        const result = await generate('query Valid { date }', {
            scalars: { Date: defineString() },
            additionalDocuments: ['query Broken {'],
        })

        expect(result.outputs.map(output => output.sourceId)).toEqual(['document-0.graphql'])
        expect(result.raw.diagnostics).toMatchObject([{
            severity: 'warning',
            code: 'skipped-document',
            sourceId: 'document-1.graphql',
            location: { line: 1, column: 15 },
        }])
        expect(result.raw.diagnostics[0]?.message).toContain('Syntax Error')
    })

    test('warns when a scalar mapping can resolve to a generated schema declaration', async () => {
        const result = await generate('query ScalarConflict { date }', {
            scalars: {
                Audit: defineGeneric('unknown', defineNamed('User')),
                Date: {
                    input: defineNamed('ExternalDate'),
                    output: defineNamed('User'),
                },
            },
        })

        expect(result.outputs).toHaveLength(1)
        expect(result.raw.diagnostics).toEqual([
            {
                severity: 'warning',
                code: 'scalar-name-conflict',
                schemaId: 'core',
                sourceId: 'schemas/core/schema.graphql',
                message: 'Scalar "Audit" input and output mapping references "User", which is also generated from the schema',
            },
            {
                severity: 'warning',
                code: 'scalar-name-conflict',
                schemaId: 'core',
                sourceId: 'schemas/core/schema.graphql',
                message: 'Scalar "Date" output mapping references "User", which is also generated from the schema',
            },
        ])
    })

    test('reports and publishes schema-level scalar warnings without a project', async () => {
        const root = resolve(fixturesRoot, 'diagnostics')
        const result = await generateDeclarations(defineConfig({
            root,
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    scalars: { Date: defineNamed('User') },
                    outputs: {
                        root: 'generated/schema-warning',
                        types: 'schema.d.ts',
                    },
                },
            },
            projects: {},
        }))

        expect(result.diagnostics).toEqual([{
            severity: 'warning',
            code: 'scalar-name-conflict',
            schemaId: 'core',
            sourceId: 'schemas/core/schema.graphql',
            message: 'Scalar "Date" input and output mapping references "User", which is also generated from the schema',
        }])
        expect(result.outputs).toMatchObject([{
            kind: 'schema-types',
            schemaId: 'core',
            file: 'generated/schema-warning/schema.d.ts',
        }])
        expect(existsSync(resolve(root, 'generated/schema-warning/schema.d.ts'))).toBe(true)
    })

    test('returns source locations for compilation errors', async () => {
        const result = await generate(`
            query MissingField {
                missing
            }
        `)

        expect(result.raw.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: 'invalid-document',
            sourceId: 'document-0.graphql',
            location: { line: 3, column: 17 },
        })
    })

    test('checks invalid documents without inspecting or creating outputs', async () => {
        writeFileSync(resolve(documentsRoot, 'check.graphql'), 'query Missing { missing }')
        const result = await checkDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'diagnostics'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                },
            },
            projects: {
                diagnostics: {
                    root: documentsRoot,
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['check.graphql'] },
                            outputs: { tree: { root: 'checked/invalid' } },
                        },
                    },
                },
            },
        }))

        expect(result.diagnostics[0]?.message).toBe('Type "Query" does not define field "missing"')
        expect(result.differences).toEqual([])
        expect(existsSync(resolve(fixturesRoot, 'diagnostics/checked/invalid'))).toBe(false)
    })

    test('keeps diagnostic source IDs physical when a filesystem path has an alias', async () => {
        const result = await generate('query MissingField { missing }', {
            alias: {
                [documentsRoot]: '@app/graphql',
            },
        })

        expect(result.diagnostics[0]).toEqual({
            severity: 'error',
            code: 'invalid-document',
            sourceId: 'document-0.graphql',
            message: 'Type "Query" does not define field "missing"',
        })
    })

    test.each([
        [
            'subscription MultipleSubscriptionFields { first second }',
            'Subscription "MultipleSubscriptionFields" must select only one top-level field',
        ],
        [
            'subscription SubscriptionIntrospection { __typename }',
            'Subscription "SubscriptionIntrospection" must not select an introspection top-level field',
        ],
    ])('validates a subscription root: %s', async (document, message) => {
        const result = await generate(document, {
            schemaFile: 'schemas/subscription.graphql',
        })

        expect(result.outputs).toEqual([])
        expect(result.raw.diagnostics.find(diagnostic => diagnostic.severity === 'error')).toMatchObject({
            severity: 'error',
            code: 'invalid-document',
            sourceId: 'document-0.graphql',
            message,
        })
    })

    test('accepts one subscription root field selected through named and inline fragments', async () => {
        const result = await generate(`
            fragment SubscriptionField on Subscription {
                ... on Subscription {
                    first
                }
            }

            subscription FragmentSubscription {
                ...SubscriptionField
            }
        `, {
            schemaFile: 'schemas/subscription.graphql',
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
    })

    test('reports a fragment cycle before validating the subscription root field count', async () => {
        const result = await generate(
            'subscription SubscriptionCycle { ...A } fragment A on Subscription { ...B } fragment B on Subscription { ...A }',
            { schemaFile: 'schemas/subscription.graphql' }
        )

        expect(result.outputs).toEqual([])
        expect(result.raw.diagnostics.find(diagnostic => diagnostic.severity === 'error')).toMatchObject({
            severity: 'error',
            code: 'invalid-document',
            sourceId: 'document-0.graphql',
            message: 'Fragment cycle detected: "A" -> "B" -> "A"',
        })
    })

    test.each([
        'query ConflictingNonnull { user(id: "1") @required { id } user(id: "1") { id } }',
        'query ConflictingNonnull { user(id: "1") { id } user(id: "1") @required { id } }',
    ])('rejects repeated fields with different nullability policies: %s', async document => {
        const result = await generate(document, {
            directives: { required: { effect: 'nonnull' } },
        })

        expect(result.outputs).toEqual([])
        expect(result.raw.diagnostics.find(diagnostic => diagnostic.severity === 'error')).toMatchObject({
            severity: 'error',
            code: 'invalid-document',
            sourceId: 'document-0.graphql',
            message: 'Selections for response name "user" have different nullability',
        })
    })

    test('rejects repeated fields with different override policies', async () => {
        const result = await generate(
            'query ConflictingOverride { user(id: "1") @opaque { id } user(id: "1") { id } }',
            {
                directives: {
                    opaque: {
                        effect: 'override',
                        type: defineNamed('OpaqueUser'),
                    },
                },
            }
        )

        expect(result.outputs).toEqual([])
        expect(result.raw.diagnostics.find(diagnostic => diagnostic.severity === 'error')).toMatchObject({
            severity: 'error',
            code: 'invalid-document',
            sourceId: 'document-0.graphql',
            message: 'Selections for response name "user" have different override types',
        })
    })

    test.each([
        [ '{ node(id: "1") { id } }', 'invalid-document', 'Operation must have a name' ],
        [ 'query Named @skip(if: true) { date }', 'unsupported-document', 'Operation directives are not supported yet' ],
        [ 'mutation MissingRoot { __typename }', 'invalid-document', 'Schema does not define a mutation root type' ],
        [ 'subscription MissingRoot { __typename }', 'invalid-document', 'Schema does not define a subscription root type' ],
        [ 'fragment UserFields on User @custom(if: true) { id }', 'unsupported-document', 'Fragment definition directives are not supported yet' ],
        [ 'schema { query: Query }', 'unsupported-document', 'Definition of kind "SchemaDefinition" is not executable' ],
        [ 'query Same { __typename } query Same { __typename }', 'invalid-document', 'Definition "Same" is declared more than once in the document' ],
        [ 'fragment Same on User { id } fragment Same on User { status }', 'invalid-document', 'Definition "Same" is declared more than once in the document' ],
        [ 'query MissingField { missing }', 'invalid-document', 'Type "Query" does not define field "missing"' ],
        [ 'query SkippedMissingField { missing @skip(if: true) }', 'invalid-document', 'Type "Query" does not define field "missing"' ],
        [ 'query SkippedCompositeMissingField { user(id: "1") { owner @skip(if: true) { missing } } }', 'invalid-document', 'Type "User" does not define field "missing"' ],
        [ 'query MissingFragment($id: ID!) { node(id: $id) { ...Missing } }', 'missing-fragment-provider', 'Fragment "Missing" was not found among the documents selected by this target' ],
        [ 'query UnknownType { ...MissingFields } fragment MissingFields on Missing { __typename }', 'invalid-document', 'Schema does not define type "Missing"' ],
        [ 'query WrongFragment($id: ID!) { node(id: $id) { ...UserFields } } fragment UserFields on Query { date }', 'invalid-document', 'Fragment "UserFields" cannot apply to type "Node"' ],
        [ 'query WrongInline($id: ID!) { node(id: $id) { ... on Query { date } } }', 'invalid-document', 'Inline fragment on "Query" cannot apply to type "Node"' ],
        [ 'query UnknownDirective { date @unknown }', 'invalid-document', 'Directive "@unknown" is not defined' ],
        [ 'query DuplicateDirective($skip: Boolean!) { __typename @skip(if: $skip) @skip(if: $skip) }', 'invalid-document', 'Directive "@skip" is used more than once at this location' ],
        [ 'query StaticallySkippedDuplicateDirective { __typename @skip(if: true) @skip(if: true) }', 'invalid-document', 'Directive "@skip" is used more than once at this location' ],
        [ 'query StaticallySkippedUnknownDirective { __typename @skip(if: true) @unknown }', 'invalid-document', 'Directive "@unknown" is not defined' ],
        [ 'query WrongLocation($id: ID!) { node(id: $id) { ...UserFields @fieldOnly } } fragment UserFields on User { id }', 'invalid-document', 'Directive "@fieldOnly" cannot be used on FRAGMENT_SPREAD' ],
        [ 'query TypenameArguments { __typename(unexpected: true) }', 'invalid-document', 'Field "__typename" does not define arguments' ],
        [ 'query TypenameSelections { __typename { nested } }', 'invalid-document', 'Field "__typename" cannot have selections' ],
        [ 'query ReservedTypenameAlias { __typename: date }', 'invalid-document', 'Aliasing a field to "__typename" is not supported because this name is reserved' ],
        [ 'query ScalarSelections { date { nested } }', 'invalid-document', 'Scalar field "Query.date" cannot have selections' ],
        [ 'query EnumSelections($id: ID!) { node(id: $id) { ... on User { status { nested } } } }', 'invalid-document', 'Enum field "User.status" cannot have selections' ],
        [ 'query UnionField { result { id } }', 'invalid-document', 'Type "SearchResult" does not define field "id"' ],
        [ 'query CompositeWithoutSelections($id: ID!) { node(id: $id) }', 'invalid-document', 'Composite field "Query.node" must have selections' ],
        [ 'query ConflictingFields { value: plain value: validate }', 'invalid-document', 'Selections for response name "value" target different fields "plain" and "validate"' ],
        [ 'query ConflictingArguments { value: user(id: "1") { id } value: user(id: "2") { id } }', 'invalid-document', 'Selections for response name "value" provide different arguments' ],
        [ 'query ConflictingTypename($id: ID!) { node(id: $id) { value: __typename value: id } }', 'invalid-document', 'Selections for response name "value" target different fields "__typename" and "id"' ],
        [ 'query InlineConflict($id: ID!) { node(id: $id) { value: id ... on User { value: status } } }', 'invalid-document', 'Selections for response name "value" target different fields "id" and "status"' ],
        [ 'query AbstractShapeConflict { result { ... on User { value: score } ... on Group { value: label } } }', 'invalid-document', 'Selections for response name "value" have incompatible return types "String!" and "Int!"' ],
        [ 'query AbstractListShapeConflict { result { ... on User { entity: related { id } } ... on Group { entity: owner { id } } } }', 'invalid-document', 'Selections for response name "entity" have incompatible return types "User!" and "[User!]!"' ],
        [ 'query NestedAbstractShapeConflict { result { ... on User { entity: owner { value: id } } ... on Group { entity: owner { value: score } } } }', 'invalid-document', 'Selections for response name "value" have incompatible return types "Int!" and "ID!"' ],
        [ 'query NullableShapeConflict { node(id: "1") { value ... on User { value } } }', 'invalid-document', 'Selections for response name "value" have incompatible return types "Int" and "Int!"' ],
        [ 'query ReversedNullableShapeConflict { node(id: "1") { ... on User { value } value } }', 'invalid-document', 'Selections for response name "value" have incompatible return types "Int!" and "Int"' ],
        [ 'query FragmentConflict($id: ID!) { node(id: $id) { value: id ...Conflict } } fragment Conflict on User { value: status }', 'invalid-document', 'Selections for response name "value" target different fields "id" and "status"' ],
        [ 'query FragmentArgumentConflict { value: user(id: "1") { id } ...Conflict } fragment Conflict on Query { value: user(id: "2") { id } }', 'invalid-document', 'Selections for response name "value" provide different arguments' ],
        [ 'query FragmentCycle($id: ID!) { node(id: $id) { ...A } } fragment A on Node { ...B } fragment B on Node { ...A }', 'invalid-document', 'Fragment cycle detected: "A" -> "B" -> "A"' ],
        [ 'query SkippedFragmentCycle { ...A } fragment A on Query { __typename ...A @skip(if: true) }', 'invalid-document', 'Fragment cycle detected: "A" -> "A"' ],
        [ 'query NullRequiredArgument { node(id: null) { id } }', 'invalid-document', 'Field "node" argument "id" is not a valid literal for input type "ID!"' ],
        [ 'query WrongBooleanLiteral { validate(boolean: "yes") }', 'invalid-document', 'Field "validate" argument "boolean" is not a valid literal for input type "Boolean"' ],
        [ 'query WrongFloatLiteral { validate(float: "1.5") }', 'invalid-document', 'Field "validate" argument "float" is not a valid literal for input type "Float"' ],
        [ 'query InfiniteFloatLiteral { validate(float: 1e9999) }', 'invalid-document', 'Field "validate" argument "float" is not a valid literal for input type "Float"' ],
        [ 'query WrongIdLiteral { validate(id: true) }', 'invalid-document', 'Field "validate" argument "id" is not a valid literal for input type "ID"' ],
        [ 'query FractionalIntLiteral { validate(int: 1.5) }', 'invalid-document', 'Field "validate" argument "int" is not a valid literal for input type "Int"' ],
        [ 'query LargeIntLiteral { validate(int: 2147483648) }', 'invalid-document', 'Field "validate" argument "int" is not a valid literal for input type "Int"' ],
        [ 'query SmallIntLiteral { validate(int: -2147483649) }', 'invalid-document', 'Field "validate" argument "int" is not a valid literal for input type "Int"' ],
        [ 'query WrongStringLiteral { validate(string: 1) }', 'invalid-document', 'Field "validate" argument "string" is not a valid literal for input type "String"' ],
        [ 'query StringEnumLiteral { validate(status: "ACTIVE") }', 'invalid-document', 'Field "validate" argument "status" is not a valid literal for input type "Status"' ],
        [ 'query UnknownEnumLiteral { validate(status: MISSING) }', 'invalid-document', 'Field "validate" argument "status" is not a valid literal for input type "Status"' ],
        [ 'query WrongInputObjectLiteral { validate(plain: "text") }', 'invalid-document', 'Field "validate" argument "plain" is not a valid literal for input type "PlainFilter"' ],
        [ 'query DuplicateInputField { validate(plain: { text: "first", text: "second" }) }', 'invalid-document', 'Field "validate" argument "plain" provides input field "text" more than once' ],
        [ 'query UnknownInputField { validate(plain: { missing: "text" }) }', 'invalid-document', 'Field "validate" argument "plain" provides unknown input field "missing"' ],
        [ 'query MissingInputField { validate(required: { optional: 1 }) }', 'invalid-document', 'Field "validate" argument "required" is missing required input field "required"' ],
        [ 'query EmptyOneOf { search(filter: {}) { id } }', 'invalid-document', 'Field "search" argument "filter" must provide exactly one non-null field' ],
        [ 'query MultipleOneOf { search(filter: { status: ACTIVE, term: "text" }) { id } }', 'invalid-document', 'Field "search" argument "filter" must provide exactly one non-null field' ],
        [ 'query NullOneOf { search(filter: { term: null }) { id } }', 'invalid-document', 'Field "search" argument "filter" must provide exactly one non-null field' ],
        [ 'query NullListItem { validate(ids: ["one", null]) }', 'invalid-document', 'Field "validate" argument "ids"[1] is not a valid literal for input type "ID!"' ],
        [ 'query NullRequiredList { users(ids: null) { id } }', 'invalid-document', 'Field "users" argument "ids" is not a valid literal for input type "[ID!]!"' ],
        [ 'query WrongDirectiveLiteral { date @include(if: "yes") }', 'invalid-document', 'Directive "@include" argument "if" is not a valid literal for input type "Boolean"' ],
        [ 'query UnknownNestedVariable { validate(plain: { text: $missing }) }', 'invalid-document', 'Variable "$missing" is not defined' ],
        [ 'query WrongNestedVariable($id: ID) { validate(plain: { text: $id }) }', 'invalid-document', 'Variable "$id" cannot be used for argument "plain"' ],
        [ 'query NullableOneOfField($term: String = "default") { search(filter: { term: $term }) { id } }', 'invalid-document', 'Variable "$term" must be non-nullable inside oneOf argument "filter"' ],
        [ 'query DuplicateArgument($id: ID!) { node(id: $id, id: $id) { id } }', 'invalid-document', 'Argument "id" is provided more than once' ],
        [ 'query UnknownArgument($id: ID!) { node(other: $id, id: $id) { id } }', 'invalid-document', 'Field "node" does not define argument "other"' ],
        [ 'query UnknownVariable { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" is not defined' ],
        [ 'query FragmentVariable { ...UserById } fragment UserById on Query { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" is not defined' ],
        [ 'query SkippedFragmentVariable { __typename ...UserById @skip(if: true) } fragment UserById on Query { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" is not defined' ],
        [ 'query WrongVariableType($id: String!) { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" cannot be used for argument "id"' ],
        [ 'query WrongVariableShape($filter: [PlainFilter]) { plain(filter: $filter) }', 'invalid-document', 'Variable "$filter" cannot be used for argument "filter"' ],
        [ 'query WrongListShape($id: ID) { users(ids: $id) { id } }', 'invalid-document', 'Variable "$id" cannot be used for argument "ids"' ],
        [ 'query NullDefault($id: ID = null) { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" cannot be used for argument "id"' ],
        [ 'query MissingArgument { node { id } }', 'invalid-document', 'Required argument "id" is missing' ],
        [ 'query VariableDirective($id: ID! @skip(if: true)) { node(id: $id) { id } }', 'unsupported-document', 'Variable directives are not supported yet' ],
        [ 'query DuplicateVariable($id: ID!, $id: ID!) { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" is defined more than once' ],
        [ 'query UnusedVariable($id: ID) { __typename }', 'invalid-document', 'Variable "$id" is never used in operation "UnusedVariable"' ],
        [ 'query WrongScalarDefault($id: ID = true) { node(id: $id) { id } }', 'invalid-document', 'Variable "$id" default value is not a valid literal for input type "ID"' ],
        [ 'query WrongListDefault($ids: [ID!] = ["one", null]) { validate(ids: $ids) }', 'invalid-document', 'Variable "$ids" default value[1] is not a valid literal for input type "ID!"' ],
        [ 'query MissingDefaultField($filter: RequiredFilter = { optional: 1 }) { validate(required: $filter) }', 'invalid-document', 'Variable "$filter" default value is missing required input field "required"' ],
        [ 'query EmptyOneOfDefault($filter: SearchFilter = {}) { search(filter: $filter) { id } }', 'invalid-document', 'Variable "$filter" default value must provide exactly one non-null field' ],
        [ 'query InvalidInput($user: User) { plain(filter: $user) }', 'unsupported-schema-type', 'Type "User" of kind "object" cannot be used as input' ],
        [ 'query InvalidInputDefault($result: SearchResult = {}) { __typename }', 'unsupported-schema-type', 'Type "SearchResult" of kind "union" cannot be used as input' ],
        [ 'query UnknownVariableType($value: Missing) { __typename }', 'invalid-document', 'Schema does not define input type "Missing"' ],
    ])('reports %s', async (document, code, message) => {
        const result = await generate(document)

        expect(result.outputs).toEqual([])
        const diagnostic = result.raw.diagnostics.find(current => current.severity === 'error')

        expect(diagnostic).toMatchObject({ code, message })
        expect(diagnostic?.location).toEqual({
            line: expect.any(Number),
            column: expect.any(Number),
        })
    })

    test('reports ambiguous fragment providers selected by explicit imports', async () => {
        const result = await generate(
            `
                #import "./document-1.graphql"
                #import "./document-2.graphql"

                query UsesDuplicate($id: ID!) { node(id: $id) { ...Duplicate } }
            `,
            {
                additionalDocuments: [
                    'fragment Duplicate on User { id }',
                    'fragment Duplicate on User { status }',
                ],
            }
        )

        expect(result.raw.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: 'ambiguous-fragment-provider',
            sourceId: 'document-0.graphql',
            location: { line: 5, column: 65 },
            message: 'Fragment "Duplicate" is defined by multiple imported documents: "document-1.graphql", "document-2.graphql"',
        })
    })

    test('requires an explicit import for an external fragment provider', async () => {
        const result = await generate(
            'query UsesExternal($id: ID!) { node(id: $id) { ...External } }',
            { additionalDocuments: ['fragment External on User { id }'] }
        )

        expect(result.raw.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: 'missing-fragment-provider',
            sourceId: 'document-0.graphql',
            message: 'Fragment "External" is external; import its provider document explicitly',
        })
    })

    test('requires an imported document to provide the referenced fragment', async () => {
        const result = await generate(
            `
                #import "./document-1.graphql"

                query UsesExternal($id: ID!) { node(id: $id) { ...External } }
            `,
            {
                additionalDocuments: [
                    'fragment Other on User { id }',
                    'fragment External on User { id }',
                ],
            }
        )

        expect(result.raw.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: 'missing-fragment-provider',
            sourceId: 'document-0.graphql',
            message: 'Fragment "External" was not found in the imported documents',
        })
    })

    test.each([
        [
            '#import "./missing.graphql"\nquery MissingImport { __typename }',
            'Imported document "./missing.graphql" is not selected by this target',
        ],
        [
            '#import "../outside.graphql"\nquery ExternalImport { __typename }',
            'Document import "../outside.graphql" is outside the project root',
        ],
    ])('rejects a document import outside target ownership', async (document, message) => {
        const result = await generate(document)

        expect(result.raw.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: 'invalid-document-import',
            sourceId: 'document-0.graphql',
            location: { line: 1, column: 1 },
            message,
        })
    })

    test('checks import ownership by physical path before applying module aliases', async () => {
        const result = await generate(
            '#import "./unselected.graphql"\nquery AliasedImport($id: ID!) { node(id: $id) { ...External } }',
            {
                additionalDocuments: ['fragment External on User { id }'],
                alias: {
                    [resolve(documentsRoot, 'document-1.graphql')]: '@shared/provider',
                    [resolve(documentsRoot, 'unselected.graphql')]: '@shared/provider',
                },
            }
        )

        expect(result.raw.diagnostics[0]).toMatchObject({
            severity: 'error',
            code: 'invalid-document-import',
            sourceId: 'document-0.graphql',
            message: 'Imported document "./unselected.graphql" is not selected by this target',
        })
    })

    test('reports an imported document skipped during parsing as unavailable', async () => {
        const result = await generate(
            '#import "./document-1.graphql"\nquery UnavailableImport { __typename }',
            { additionalDocuments: ['query Broken {'] }
        )

        expect(result.raw.diagnostics).toMatchObject([
            {
                severity: 'warning',
                code: 'skipped-document',
                sourceId: 'document-1.graphql',
            },
            {
                severity: 'error',
                code: 'invalid-document-import',
                sourceId: 'document-0.graphql',
                location: { line: 1, column: 1 },
                message: 'Imported document "./document-1.graphql" is unavailable',
            },
        ])
    })

    test('reports generated type-name collisions without emitting declarations', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'name-collisions'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    enumsModule: '@app/graphql/enums',
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: {
                                files: [
                                    'enum.graphql',
                                    'exact.graphql',
                                    'normalized-fragments.graphql',
                                    'normalized-operations.graphql',
                                    'payload-fragment.graphql',
                                    'typed-document-node.graphql',
                                    'variables-fragment.graphql',
                                ],
                            },
                            outputs: { tree: { root: 'generated/invalid-types' } },
                        },
                    },
                },
            },
        }))

        expect(result.outputs).toEqual([])
        expect(result.diagnostics.map(diagnostic => ({
            sourceId: diagnostic.sourceId,
            message: diagnostic.message,
        }))).toEqual([
            {
                sourceId: 'enum.graphql',
                message: 'Generated type name "Status" is used by both import from "@app/graphql/enums" and fragment "Status"',
            },
            {
                sourceId: 'exact.graphql',
                message: 'Generated type name "Exact" is used by both import from "@app/graphql/schema" and fragment "Exact"',
            },
            {
                sourceId: 'normalized-fragments.graphql',
                message: 'Generated type name "UserDetails" is used by both fragment "user_details" and fragment "UserDetails"',
            },
            {
                sourceId: 'normalized-operations.graphql',
                message: 'Generated type name "UserDetailsQueryVariables" is used by both operation "user_details" variables and operation "UserDetails" variables',
            },
            {
                sourceId: 'payload-fragment.graphql',
                message: 'Generated type name "ViewerQueryPayload" is used by both fragment "ViewerQueryPayload" and operation "Viewer" payload',
            },
            {
                sourceId: 'typed-document-node.graphql',
                message: 'Generated type name "TypedDocumentNode" is used by both import from "@graphql-typed-document-node/core" and fragment "TypedDocumentNode"',
            },
            {
                sourceId: 'variables-fragment.graphql',
                message: 'Generated type name "ViewerQueryVariables" is used by both fragment "ViewerQueryVariables" and operation "Viewer" variables',
            },
        ])
    })

    test('reports generated runtime export collisions independently from type names', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'name-collisions'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    naming: { operationNames: 'keep' },
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: { files: ['runtime-exports.graphql'] },
                            outputs: { tree: { root: 'generated/invalid-runtime' } },
                        },
                    },
                },
            },
        }))

        expect(result.outputs).toEqual([])
        expect(result.diagnostics[0]).toMatchObject({
            code: 'invalid-document',
            sourceId: 'runtime-exports.graphql',
            message: 'Generated runtime name "viewerQuery" is used by both operation "Viewer" export and operation "viewer" export',
        })
    })

    test('reports generated runtime names that collide with type imports', async () => {
        const result = await generateDeclarations(defineConfig({
            root: resolve(fixturesRoot, 'name-collisions'),
            schemas: {
                core: {
                    file: 'schemas/core/schema.graphql',
                    typesModule: '@app/graphql/schema',
                    naming: {
                        fragmentNames: 'keep',
                        operationNames: 'keep',
                    },
                },
            },
            projects: {
                app: {
                    root: 'projects/app/documents',
                    targets: {
                        core: {
                            schema: 'core',
                            documents: {
                                files: [
                                    'runtime-import.graphql',
                                    'runtime-import-fragment.graphql',
                                ],
                            },
                            outputs: { tree: { root: 'generated/invalid-runtime-import' } },
                        },
                    },
                },
            },
        }))

        expect(result.outputs.map(output => output.sourceId)).toEqual([
            'runtime-import-fragment.graphql',
        ])
        expect(result.diagnostics[0]).toMatchObject({
            code: 'invalid-document',
            sourceId: 'runtime-import.graphql',
            message: 'Generated runtime name "viewerQuery" is used by both import from "runtime-import-fragment.graphql" and operation "Viewer" export',
        })
    })

    test('reports a fragment whose source document could not be compiled', async () => {
        const result = await generate(
            '#import "./document-1.graphql"\nquery UsesUnavailable($id: ID!) { node(id: $id) { ...Unavailable } }',
            {
                additionalDocuments: [
                    'fragment Unavailable on User { id } query Broken { missing }',
                ],
            }
        )

        expect(result.outputs).toEqual([])
        expect(result.diagnostics).toEqual([
            {
                severity: 'error',
                code: 'unavailable-fragment-provider',
                sourceId: 'document-0.graphql',
                message: 'Fragment "Unavailable" provider "document-1.graphql" is unavailable after compilation',
            },
            {
                severity: 'error',
                code: 'invalid-document',
                sourceId: 'document-1.graphql',
                message: 'Type "Query" does not define field "missing"',
            },
        ])
    })

    test('reports a fragment condition that is not a composite type', async () => {
        const result = await generate('fragment ScalarFragment on String { __typename }')

        expect(result.diagnostics[0]?.message).toBe(
            'Type "String" is not a supported composite output type'
        )
    })

    test.each([
        [ { Date: { input: defineNamed('DateInput') } }, 'Scalar "Date" does not define an output mapping' ],
        [ { Date: { output: defineNamed('DateOutput') } }, 'Scalar "Date" does not define an input mapping' ],
    ])('reports incomplete scalar mappings', async (scalars, message) => {
        const document = message.includes('output')
            ? 'query DateOutput { date }'
            : 'query DateInput($date: Date!) { node(id: $date) { id } }'
        const result = await generate(document, { scalars })

        expect(result.diagnostics[0]?.message).toBe(message)
    })

    test('renders lists, enums, conditional selections and aliased typenames', async () => {
        const result = await generate(`
            query Complete(
                $ids: [ID!]!
                $id: ID!
                $filter: PlainFilter!
                $condition: Boolean! = true
            ) {
                omitted: date @skip(if: true)
                users(ids: $ids) { id }
                plain(filter: $filter)
                node(id: $id) @include(if: $condition) {
                    kind: __typename @include(if: $condition)
                    plainKind: __typename
                    __typename @include(if: $condition)
                    ... @custom(if: true) { id }
                    ... on User @custom(if: true) {
                        status
                    }
                    ...UserFields @include(if: $condition)
                }
            }

            fragment UserFields on User {
                id
            }
        `, {
            scalars: { Date: defineString() },
            directives: { custom: { effect: 'conditional' } },
        })

        expect(result.diagnostics).toEqual([])
        expect(result.outputs[0]?.content).toContain('ids: Array<string>')
        expect(result.outputs[0]?.content).toContain('kind?:')
        expect(result.outputs[0]?.content).toContain('status?:')
        expect(result.outputs[0]?.content).not.toContain('omitted')
    })

    test('accepts valid literal forms through the public generation boundary', async () => {
        const result = await generate(`
            query Literals {
                node(id: 42) { id }
                search(filter: { status: ACTIVE }) { id }
                validate(
                    boolean: true
                    date: { arbitrary: "custom scalar input" }
                    float: 1
                    id: "owner"
                    ids: [1, "two"]
                    int: 0
                    plain: { text: "value" }
                    required: { required: "value" }
                    status: INACTIVE
                    string: "value"
                )
            }
        `)

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
    })

    test('accepts nested variables and input-field defaults', async () => {
        const result = await generate(`
            query NestedVariables($text: String, $requiredText: String!, $id: ID) {
                search(filter: { term: $requiredText }) { id }
                validate(
                    defaulted: { required: $id }
                    plain: { text: $text }
                )
            }
        `)

        expect(result.diagnostics).toEqual([])
        expect(result.outputs).toHaveLength(1)
    })

    test.each([
        'query VariableDefault($id: ID = "default") { node(id: $id) { id } }',
        'query LocationDefault($id: ID) { defaulted(id: $id) }',
    ])('accepts a nullable variable when a non-null default guarantees a value', async document => {
        expect((await generate(document)).diagnostics).toEqual([])
    })

    test('reports an entirely unmapped custom scalar used as input', async () => {
        const result = await generate('query Unmapped($date: Date!) { node(id: $date) { id } }')

        expect(result.diagnostics[0]?.message).toBe('Scalar "Date" is not supported yet')
    })
})
