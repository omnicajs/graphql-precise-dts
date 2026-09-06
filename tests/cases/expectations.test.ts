import { afterAll, describe, expect, test } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig, generateDeclarations } from '@/index'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { caseConfig, caseName, declarationCases, expectedFile } from './catalog'

const workspace = createFixtureWorkspace()
const fixturesRoot = resolve(__dirname, '../fixtures/cases')
const read = (file: string): string => readFileSync(file, 'utf8')
const filesIn = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? filesIn(path) : [path]
})

afterAll(workspace.dispose)

describe('checked-in declaration expectations', () => {
    test('accounts for every fixture set', () => {
        const fixtures = readdirSync(fixturesRoot, { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
        // This fixture intentionally rejects schema publication, so it has no .d.ts oracle.
        const covered = [...new Set([...declarationCases.map(entry => entry.fixture), 'name-collisions'])].sort()
        expect(covered).toEqual(fixtures)
    })

    test('includes every active expectation in a declaration contract', () => {
        const covered = declarationCases.flatMap(entry => {
            const fixture = resolve(fixturesRoot, entry.fixture)
            const suffix = entry.variant ? `.${entry.variant}` : ''
            const config = JSON.parse(read(resolve(fixture, `tsconfig${suffix}.json`))) as { files: string[] }
            return [...config.files, ...(entry.aggregate ? ['expected/aggregate.d.ts'] : [])]
                .map(file => resolve(fixture, file))
        })
        const artifacts = filesIn(fixturesRoot).filter(file => file.includes('/expected/') && file.endsWith('.ts'))
        expect([...new Set(covered)].sort()).toEqual(artifacts.sort())
    })

    for (const entry of declarationCases) {
        test(`reproduces every saved output of ${caseName(entry)}`, async () => {
            const result = await generateDeclarations(caseConfig(entry, resolve(workspace.root, entry.fixture)))
            const suffix = entry.variant ? `.${entry.variant}` : ''
            const fixture = resolve(fixturesRoot, entry.fixture)
            const config = JSON.parse(read(resolve(fixture, `tsconfig${suffix}.json`))) as { files: string[] }
            const expectedFiles = [...config.files, ...(entry.aggregate ? ['expected/aggregate.d.ts'] : [])].sort()

            expect(result.outputs.map(output => expectedFile(entry, output)).sort()).toEqual(expectedFiles)
            expect(result.diagnostics.map(({ severity, code, sourceId }) => ({ severity, code, sourceId }))).toEqual(
                JSON.parse(read(resolve(fixture, `diagnostics${suffix}.json`)))
            )
            for (const output of result.outputs) {
                const expected = read(resolve(fixture, expectedFile(entry, output)))
                expect(output.content, expectedFile(entry, output)).toBe(expected)
                expect(read(resolve(workspace.root, entry.fixture, output.file))).toBe(expected)
            }
            const contracts = readdirSync(resolve(__dirname, caseName(entry)))
                .filter(file => file.endsWith('.test-d.ts'))
            expect(contracts.length).toBeGreaterThan(0)
        })
    }

    test.each([
        ['core', 'Generated schema declaration name "UserProfile" is used by both type "UserProfile" and type "user_profile"'],
        ['helper', 'Generated schema declaration name "Exact" is used by both helper "Exact" and type "Exact"'],
        ['arguments', 'Generated schema declaration name "QueryUserArgs" is used by both arguments for "Query.user" and type "QueryUserArgs"'],
    ])('rejects the %s schema in name-collisions before publishing declarations', async (schema, message) => {
        await expect(generateDeclarations(defineConfig({
            root: resolve(workspace.root, 'name-collisions'),
            schemas: {
                main: {
                    file: `schemas/${schema === 'core' ? 'core/schema' : schema}.graphql`,
                    typesModule: '@app/graphql/schema',
                    outputs: { root: `generated/${schema}`, types: 'schema.d.ts' },
                },
            },
            projects: {},
        }))).rejects.toThrow(message)
    })
})
