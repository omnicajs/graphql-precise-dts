import { afterAll, expect, test } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { checkDeclarations, generateDeclarations } from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { caseConfig, declarationCases } from './catalog'

const workspace = createFixtureWorkspace()
const entry = declarationCases.find(entry => entry.fixture === 'module-overlay')!
const root = resolve(workspace.root, entry.fixture)
const config = () => caseConfig(entry, root)

afterAll(workspace.dispose)

test('publishes external modules for operations, fragments and mixed documents', async () => {
    const input = caseConfig({ ...entry, schema: { ...entry.schema, naming: undefined }, files: ['fragments/BookFields.graphql', 'queries/book.graphql', 'mixed.graphql'] }, root)
    const result = await generateDeclarations(input)
    expect(result.diagnostics).toEqual([])
    for (const output of result.outputs.filter(output => output.kind === 'document-declaration')) {
        expect(output.content).toBe(readFileSync(resolve(__dirname, '../fixtures/cases/module-overlay/expected/app', `${output.sourceId}.d.ts`), 'utf8'))
    }
})

test('compiles an interface without implementations and conditional local fragments', async () => {
    const input = caseConfig({ ...entry, schema: { ...entry.schema, naming: undefined }, files: ['remote.graphql'] }, root)
    const result = await generateDeclarations(input)
    expect(result.diagnostics).toEqual([])
    expect(result.outputs.find(output => output.kind === 'document-declaration')?.content).toBe(
        readFileSync(resolve(__dirname, '../fixtures/cases/module-overlay/expected/app/remote.graphql.d.ts'), 'utf8')
    )
})

test('publishes the complete overlay and casing contract without rewriting it on check', async () => {
    const result = await generateDeclarations(config())
    expect(result.diagnostics).toEqual([])
    expect(result.outputs).toHaveLength(6)
    expect((await checkDeclarations(config())).differences).toEqual([])
})

test.each([
    ['keep', 'IN_REVIEW'],
    ['pascalCase', 'InReview'],
    ['camelCase', 'inReview'],
    ['snakeCase', 'in_review'],
] as const)('supports %s enum member casing without changing wire values', async (enumMembers, member) => {
    const result = await generateDeclarations({
        ...config(), projects: {},
        schemas: { main: { ...config().schemas.main, naming: { enumMembers } } },
    })
    expect(result.diagnostics).toEqual([])
    expect(result.outputs.find(output => output.kind === 'schema-enums')?.content).toContain(`${member} = 'IN_REVIEW'`)
})

test('applies a shorthand naming style to enum members', async () => {
    const result = await generateDeclarations({
        ...config(), projects: {},
        schemas: { main: { ...config().schemas.main, naming: 'camelCase' } },
    })
    expect(result.outputs.find(output => output.kind === 'schema-enums')?.content).toContain('inReview = \'IN_REVIEW\'')
})

test.each([
    ['IN_REVIEW InReview', 'Generated schema declaration name "InReview" is used by both enum member "State.IN_REVIEW" and enum member "State.InReview"'],
    ['_1_A', 'Generated enum member name "1A" for "State._1_A" is not a valid TypeScript identifier'],
])('rejects enum casing that cannot preserve distinct valid members: %s', async (members, message) => {
    const file = 'schemas/core/invalid-casing.graphql'
    writeFileSync(resolve(root, file), `enum State { ${members} } type Query { state: State! }`)
    await expect(generateDeclarations({
        ...config(), projects: {},
        schemas: { main: { ...config().schemas.main, file } },
    })).rejects.toThrow(message)
})
