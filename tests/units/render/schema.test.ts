import {
    describe,
    expect,
    test,
} from 'vitest'

import { renderSchemaDeclaration } from '../../../src/render/schema'

describe('schema render', () => {
    test('renders sorted scalar declarations and enum unions', () => {
        const result = renderSchemaDeclaration({
            scalars: new Map([
                [ 'DateTime', { input: 'string', output: 'Date' } ],
                [ 'String', { input: 'string', output: 'string' } ],
                [ 'ID', { input: 'string', output: 'string' } ],
            ]),
            enums: new Map([
                [ 'UserStatus', [
                    { name: 'ACTIVE', value: 'ACTIVE' },
                    { name: 'BLOCKED', value: 'BLOCKED' },
                ] ],
            ]),
        })

        expect(result).toBe([
            'export type Scalars = {',
            '\tID: { input: string; output: string; };',
            '\tString: { input: string; output: string; };',
            '\tDateTime: { input: string; output: Date; };',
            '};\n',
            `export type UserStatus = 'ACTIVE' | 'BLOCKED'`,
        ].join('\n'))
    })

    test('renders empty output for an empty schema registry', () => {
        expect(renderSchemaDeclaration({
            scalars: new Map(),
            enums: new Map(),
        })).toBe('')
    })

    test('sorts primitive scalars ahead of custom scalars in canonical order', () => {
        const result = renderSchemaDeclaration({
            scalars: new Map([
                [ 'DateTime', { input: 'string', output: 'Date' } ],
                [ 'Float', { input: 'number', output: 'number' } ],
                [ 'ID', { input: 'string', output: 'string' } ],
            ]),
            enums: new Map(),
        })

        expect(result).toBe([
            'export type Scalars = {',
            '\tID: { input: string; output: string; };',
            '\tFloat: { input: number; output: number; };',
            '\tDateTime: { input: string; output: Date; };',
            '};',
        ].join('\n'))
    })
})
