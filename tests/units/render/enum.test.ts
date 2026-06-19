import {
    describe,
    expect,
    test,
} from 'vitest'

import { renderEnumsDeclaration } from '../../../src/render/enum'

describe('enum render', () => {
    test('fails when enum values collide after naming normalization', () => {
        expect(() => renderEnumsDeclaration(new Map([
            [ 'UserStatus', {
                entries: [
                    { name: 'IS_ACTIVE', value: 'IS_ACTIVE' },
                    { name: 'IsActive', value: 'IsActive' },
                ],
            } ],
        ]))).toThrow(
            'Name collision detected in generated enum declarations: enum value in "UserStatus" "IS_ACTIVE" and "IsActive" both render as "IsActive". Adjust namingConvention so generated enum declaration names are unique.'
        )
    })

    test('renders sorted enum declarations', () => {
        const result = renderEnumsDeclaration(new Map([
            [ 'UserStatus', {
                entries: [
                    { name: 'ACTIVE', value: 'ACTIVE' },
                    { name: 'BLOCKED', value: 'BLOCKED' },
                ],
            } ],
            [ 'UserRole', {
                entries: [
                    { name: 'ADMIN', value: 'ADMIN' },
                ],
            } ],
        ]))

        expect(result).toBe([
            'export enum UserRole {',
            `\tAdmin = 'ADMIN',`,
            '}',
            '',
            'export enum UserStatus {',
            `\tActive = 'ACTIVE',`,
            `\tBlocked = 'BLOCKED',`,
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
            `\tBasic = 'BASIC',`,
            `\t/** @deprecated Use \`tariffType === TariffType.Basic\` instead */`,
            `\tLegacy = 'LEGACY',`,
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
            `\tBasic = 'BASIC',`,
            '}',
        ].join('\n'))
    })
})
