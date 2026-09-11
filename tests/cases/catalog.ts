import type { Config, SchemaConfig } from '@/index'

import { defineConfig, defineString, defineUnknown } from '@/index'
import { richScalars } from './scalar-contract'

type DeclarationCase = {
    fixture: string
    variant?: string
    schema?: Partial<SchemaConfig>
    project?: string
    documentsRoot?: string
    files?: string[]
    operations?: Record<string, string>
    expectedRoot?: string
    resolve?: Config['resolve']
    aggregate?: boolean
}

export const declarationCases: DeclarationCase[] = [
    { fixture: 'abstract-fragment-narrowing' },
    { fixture: 'client-typename', schema: { typename: 'abstract' } },
    { fixture: 'module-names', schema: { typename: 'abstract', naming: { fragmentNames: 'keep' } } },
    { fixture: 'module-overlay', schema: { enumsModule: '@app/graphql/enums', naming: { enumMembers: 'pascalCase' } } },
    {
        fixture: 'abstract-selections', aggregate: true, project: 'search-ui',
        schema: {
            file: 'schemas/search/schema.graphql', typesModule: '@search/graphql/schema',
            enumsModule: '@search/graphql/enums', scalars: { DateTime: defineString() },
            directives: { includeArchived: { effect: 'conditional' } },
        },
    },
    { fixture: 'cli', documentsRoot: 'documents', schema: { file: 'schema.graphql' } },
    { fixture: 'conditional-fragment' },
    {
        fixture: 'custom-naming',
        schema: {
            typesModule: '@naming/schema', enumsModule: '@naming/enums',
            naming: { typeNames: 'snakeCase', operationNames: 'keep', fragmentNames: 'camelCase' },
        },
    },
    {
        fixture: 'diagnostics', project: 'directives',
        schema: {
            scalars: { Date: defineString() },
            directives: {
                opaque: { effect: 'override', type: defineString() },
                required: { effect: 'nonnull' },
                review: {
                    field: { effect: 'warn', message: 'Review the selected identifier' },
                    fragmentSpread: { effect: 'conditional' }, inlineFragment: { effect: 'warn' },
                },
            },
        },
    },
    {
        fixture: 'diagnostics', variant: 'standard', project: 'standard',
        schema: { file: 'schemas/standard/schema.graphql', scalars: { JSON: defineUnknown() } },
        expectedRoot: 'expected/standard',
        files: [
            'scalar-object-variable.graphql', 'scalar-list-variable.graphql',
            'schema-introspection.graphql', 'type-introspection.graphql',
            'typename-alias.graphql', 'typename-alias-fragment.graphql', 'typename-alias-abstract.graphql',
            'typename-alias-sibling.graphql',
            'typename-alias-repeated.graphql', 'typename-alias-repeated-reversed.graphql', 'typename-alias-repeated-nested.graphql',
            'operation-directive.graphql', 'fragment-definition-directive.graphql', 'variable-definition-directive.graphql',
            'introspection-details.graphql', 'definition-directive-variables.graphql', 'subscription-nested-directive.graphql',
            'unreachable-fragment-fields.graphql',
            'subscription-applicable-inline.graphql', 'subscription-applicable-spread.graphql',
            'subscription-unreachable-directive.graphql',
        ],
    },
    { fixture: 'fragment-heavy' },
    { fixture: 'fragment-providers' },
    { fixture: 'fragment-variables' },
    {
        fixture: 'input-values', aggregate: true, project: 'search-ui',
        schema: { file: 'schemas/search/schema.graphql', typesModule: '@search/graphql/schema', enumsModule: '@search/graphql/enums' },
    },
    { fixture: 'literal-arguments', project: 'search-ui', schema: { file: 'schemas/search/schema.graphql', typesModule: '@search/graphql/schema' } },
    ...['core', 'analytics'].map(variant => ({
        fixture: 'multi-schema-project', variant,
        schema: { file: `schemas/${variant}/schema.graphql`, typesModule: `@app/graphql/${variant}/schema` },
        files: [`${variant}/dashboard.graphql`], expectedRoot: `expected/${variant}`,
        operations: { [`${variant}/dashboard.graphql`]: `expected/app/${variant}/dashboard.graphql.d.ts` },
    })),
    ...['core', 'analytics'].map(variant => ({
        fixture: 'multiple-schemas', variant, project: `${variant}-app`,
        schema: { file: `schemas/${variant}/schema.graphql` }, expectedRoot: `expected/${variant}-app`,
        operations: { 'queries/dashboard.graphql': `expected/${variant}-app/types.d.ts` },
    })),
    { fixture: 'naming-boundaries' },
    { fixture: 'publication' },
    { fixture: 'repeated-selections' },
    {
        fixture: 'scalar-mappings', schema: { scalars: richScalars }, files: ['queries/event.graphql'],
        operations: { 'queries/event.graphql': 'expected/event.graphql.d.ts' },
    },
    {
        fixture: 'schema-contract', aggregate: true, schema: { enumsModule: '@app/graphql/enums', scalars: { DateTime: defineString() } },
        operations: { 'queries/search.graphql': 'expected/operations.d.ts' },
    },
    { fixture: 'selection-composition' },
    { fixture: 'shared-schema', project: 'shell', operations: { 'queries/customer.graphql': 'expected/shell/types.d.ts' } },
    {
        fixture: 'single-schema-project', aggregate: true,
        schema: { file: 'schemas/main/schema.graphql', typesModule: '@case/schema', enumsModule: '@case/enums', scalars: { DateTime: defineString() } },
        resolve: { alias: { 'projects/app/documents': '~tests/fixtures/documents' } },
    },
]

export const caseName = (entry: DeclarationCase) => [entry.fixture, entry.variant].filter(Boolean).join('/')

export const caseConfig = (entry: DeclarationCase, root: string) => defineConfig({
    root,
    resolve: entry.resolve,
    schemas: {
        main: {
            file: 'schemas/core/schema.graphql', typesModule: '@app/graphql/schema', ...entry.schema,
            outputs: { root: 'generated/schema', types: 'schema.d.ts', ...(entry.schema?.enumsModule ? { enums: 'enums.ts' } : {}) },
        },
    },
    projects: {
        [entry.project ?? 'app']: {
            root: entry.documentsRoot ?? `projects/${entry.project ?? 'app'}/documents`,
            targets: {
                main: {
                    schema: 'main',
                    documents: entry.files ? { files: entry.files } : { glob: { include: ['**/*.graphql'] } },
                    outputs: {
                        tree: { root: 'generated/operations' },
                        ...(entry.aggregate ? { aggregate: { file: 'aggregate.d.ts' } } : {}),
                    },
                },
            },
        },
    },
})

export const expectedFile = (entry: DeclarationCase, output: { kind: string; sourceId?: string }) => {
    const root = entry.expectedRoot ?? 'expected'
    if (output.kind === 'schema-types') return `${root}/schema.d.ts`
    if (output.kind === 'schema-enums') return `${root}/enums.ts`
    if (output.kind === 'aggregate-declaration') return `${root}/aggregate.d.ts`
    return entry.operations?.[output.sourceId!] ?? `expected/${entry.project ?? 'app'}/${output.sourceId}.d.ts`
}
