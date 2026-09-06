import { afterAll, expect, test } from 'vitest'
import { InMemoryCache } from '@apollo/client/cache'
import { buildSchema, executeSync, parse } from 'graphql'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { generateDeclarations } from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { caseConfig, declarationCases } from './catalog'

const workspace = createFixtureWorkspace()
const entry = declarationCases.find(entry => entry.fixture === 'client-typename')!
const root = resolve(workspace.root, entry.fixture)

afterAll(workspace.dispose)

test.each([
    '__typename @skip(if: true)',
    '__typename @include(if: false)',
    'kind: __typename @skip(if: true)',
])('does not require a discriminator suppressed by an explicit selection: %s', async selection => {
    const source = `query View { agent { ${selection} id } }`
    writeFileSync(resolve(root, 'schemas/core/interface.graphql'), 'interface Agent { id: ID! } type Person implements Agent { id: ID! } type Team implements Agent { id: ID! } type Query { agent: Agent! }')
    writeFileSync(resolve(root, 'projects/app/documents/skipped.graphql'), source)
    const result = await generateDeclarations(caseConfig({ ...entry, schema: { ...entry.schema, file: 'schemas/core/interface.graphql' }, files: ['skipped.graphql'] }, root))
    const schema = buildSchema(readFileSync(resolve(root, 'schemas/core/interface.graphql'), 'utf8'))
    const response = executeSync({
        schema,
        document: new InMemoryCache().transformDocument(parse(source)),
        rootValue: { agent: { __typename: 'Person', id: 'a' } },
    })
    expect(response.errors).toBeUndefined()
    expect(response.data).toEqual({ agent: { id: 'a' } })
    expect(result.diagnostics).toEqual([])
    expect(result.outputs.find(output => output.kind === 'document-declaration')?.content)
        .toContain('__typename?: \'Person\' | \'Team\';')
})

test.each([
    'fragment Name on Agent { __typename @required id } query View { agent { ...Name } }',
    'fragment Name on Agent { id } query View { agent { __typename @required ...Name } }',
    'fragment Name on Agent { id } query View { agent { ...Name } }',
    'fragment Name on Agent { __typename @required id } query View($show: Boolean!) { agent { ...Name @include(if: $show) } }',
    'fragment Name on Agent { id } query View($show: Boolean!) { agent { __typename @required ...Name @include(if: $show) } }',
    'fragment Name on Agent { id } query View($show: Boolean!) { agent { ...Name @include(if: $show) } }',
])('composes the client discriminator with fragment directive policies: %s', async source => {
    writeFileSync(resolve(root, 'schemas/core/policies.graphql'), 'directive @required on FIELD interface Agent { id: ID! } type Person implements Agent { id: ID! } type Query { agent: Agent! }')
    writeFileSync(resolve(root, 'projects/app/documents/policies.graphql'), source)
    const result = await generateDeclarations(caseConfig({
        ...entry,
        schema: { ...entry.schema, file: 'schemas/core/policies.graphql', directives: { required: { effect: 'nonnull' } } },
        files: ['policies.graphql'],
    }, root))
    expect(result.diagnostics).toEqual([])
    expect(result.outputs.find(output => output.kind === 'document-declaration')?.content).toContain('__typename: \'Person\';')
})
