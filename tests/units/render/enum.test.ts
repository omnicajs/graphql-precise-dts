import {
    describe,
    expect,
    test,
} from 'vitest'

import { renderEnumsDeclaration } from '../../../src/render/enum'

describe('enum render', () => {
    test('renders sorted enum declarations', () => {
        const result = renderEnumsDeclaration(new Map([
            [ 'UserStatus', [
                { name: 'ACTIVE', value: 'ACTIVE' },
                { name: 'BLOCKED', value: 'BLOCKED' },
            ] ],
        ]))

        expect(result).toBe([
            'export enum UserStatus {',
            `\tACTIVE = 'ACTIVE',`,
            `\tBLOCKED = 'BLOCKED',`,
            '}',
        ].join('\n'))
    })

    test('renders empty output for an empty enum map', () => {
        expect(renderEnumsDeclaration(new Map())).toBe('')
    })
})
