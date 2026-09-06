import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { parse } from 'graphql'
import { readdirSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fixturesRoot = resolve(__dirname, 'fixtures/cases')

const listFiles = (directory: string): ReadonlyArray<string> => readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
        const path = resolve(directory, entry.name)

        return entry.isDirectory() ? listFiles(path) : [ path ]
    })
    .sort()

const read = (path: string): string => readFileSync(path, 'utf8')

describe('fixture catalog', () => {
    test('contains valid SDL and GraphQL documents in every scenario', () => {
        const files = listFiles(fixturesRoot)

        for (const schemaFile of files.filter(path => path.endsWith('/schema.graphql'))) {
            expect(() => buildSchema(read(schemaFile))).not.toThrow()
        }

        for (const documentFile of files.filter(path => (
            path.endsWith('.graphql') && !path.endsWith('/schema.graphql')
        ))) {
            expect(() => parse(read(documentFile))).not.toThrow()
        }
    })

    test('reserves repeated paths and operation names for project-isolation scenarios', () => {
        const sharedSchemaDocuments = [
            'shared-schema/projects/shell/documents/queries/customer.graphql',
            'shared-schema/projects/customer-sdk/documents/queries/customer.graphql',
        ].map(path => read(resolve(fixturesRoot, path)))
        const multipleSchemaDocuments = [
            'multiple-schemas/projects/core-app/documents/queries/dashboard.graphql',
            'multiple-schemas/projects/analytics-app/documents/queries/dashboard.graphql',
        ].map(path => read(resolve(fixturesRoot, path)))

        expect(sharedSchemaDocuments.every(document => document.includes('query Customer'))).toBe(true)
        expect(multipleSchemaDocuments.every(document => document.includes('query Dashboard'))).toBe(true)
    })
})
