import {
    describe,
    expect,
    test,
} from 'vitest'

import { renderSchemaDeclaration } from '../../src/render/schema'

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
})
