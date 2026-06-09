import {
    describe,
    expect,
    test,
} from 'vitest'

import { renderEnumsDeclaration } from '../../../src/render/enum'

describe('enum render', () => {
    test('renders sorted enum declarations', () => {
        const result = renderEnumsDeclaration(new Map([
            [ 'UserStatus', {
                entries: [
                    { name: 'ACTIVE', value: 'ACTIVE' },
                    { name: 'BLOCKED', value: 'BLOCKED' },
                ],
            } ],
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

    test('renders enum value descriptions and deprecations as JSDoc', () => {
        const result = renderEnumsDeclaration(new Map([
            [ 'TariffType', {
                entries: [
                    { name: 'BASIC', value: 'BASIC', description: 'Basic tariff.' },
                    {
                        name: 'LEGACY',
                        value: 'LEGACY',
                        deprecationReason: 'Use `tariffType === TariffType.Basic` instead',
                    },
                ],
            } ],
        ]))

        expect(result).toBe([
            'export enum TariffType {',
            `\t/** Basic tariff. */`,
            `\tBASIC = 'BASIC',`,
            `\t/** @deprecated Use \`tariffType === TariffType.Basic\` instead */`,
            `\tLEGACY = 'LEGACY',`,
            '}',
        ].join('\n'))
    })

    test('renders enum descriptions as JSDoc', () => {
        const result = renderEnumsDeclaration(new Map([
            [ 'TariffType', {
                description: 'Available tariff types.',
                entries: [
                    { name: 'BASIC', value: 'BASIC' },
                ],
            } ],
        ]))

        expect(result).toBe([
            '/** Available tariff types. */',
            'export enum TariffType {',
            `\tBASIC = 'BASIC',`,
            '}',
        ].join('\n'))
    })
})
