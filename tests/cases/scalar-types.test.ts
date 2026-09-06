import {
    afterAll,
    expect,
    test,
} from 'vitest'

import { defineConfig, generateDeclarations } from '@/index'
import { richScalars } from './scalar-contract'
import { createFixtureWorkspace } from '../fixtures/workspace'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const fixturesRoot = fixtureWorkspace.root
const readFixture = fixtureWorkspace.readFixture

afterAll(fixtureWorkspace.dispose)

test('uses structured scalar types in schema and operation declarations', async () => {
    const root = resolve(fixturesRoot, 'scalar-mappings')
    const result = await generateDeclarations(defineConfig({
        root,
        schemas: {
            core: {
                file: 'schemas/core/schema.graphql',
                typesModule: '@app/graphql/schema',
                scalars: richScalars,
                outputs: {
                    root: 'generated/rich/schema',
                    types: 'schema.d.ts',
                },
            },
        },
        projects: {
            app: {
                root: 'projects/app/documents',
                targets: {
                    core: {
                        schema: 'core',
                        documents: { files: ['queries/event.graphql'] },
                        outputs: { tree: { root: 'generated/rich/operations' } },
                    },
                },
            },
        },
    }))

    expect(result.diagnostics).toEqual([])
    expect(result.outputs[0]?.content).toBe(
        readFixture('scalar-mappings/expected/schema.d.ts')
    )
    expect(result.outputs[1]?.content).toBe(
        readFixture('scalar-mappings/expected/event.graphql.d.ts')
    )
})
