import type { ConfigScalar } from '../../src/config'

import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    getScalarPrimitiveTypeTs,
    getScalarTsType,
    isScalarCustomKey,
    isScalarPrimitiveKey,
    resolveCustomScalarTypeTs,
} from '../../src/modules/scalar-type-mapping'

describe('converting graphQL scalars to TS types', () => {
    test('resolves built-in scalar artifacts types', () => {
        expect(getScalarPrimitiveTypeTs('ID')).toBe('string')
        expect(getScalarPrimitiveTypeTs('String')).toBe('string')
        expect(getScalarPrimitiveTypeTs('Boolean')).toBe('boolean')
        expect(getScalarPrimitiveTypeTs('Int')).toBe('number')
        expect(getScalarPrimitiveTypeTs('Float')).toBe('number')
    })

    test('resolves built-in scalar input types explicitly', () => {
        expect(getScalarPrimitiveTypeTs('ID', 'input')).toBe('string')
        expect(getScalarPrimitiveTypeTs('String', 'input')).toBe('string')
        expect(getScalarPrimitiveTypeTs('Boolean', 'input')).toBe('boolean')
        expect(getScalarPrimitiveTypeTs('Int', 'input')).toBe('number')
        expect(getScalarPrimitiveTypeTs('Float', 'input')).toBe('number')
    })

    test('returns primitive keys only for GraphQL built-in scalars', () => {
        expect(isScalarPrimitiveKey('ID')).toBe(true)
        expect(isScalarPrimitiveKey('String')).toBe(true)
        expect(isScalarPrimitiveKey('Boolean')).toBe(true)
        expect(isScalarPrimitiveKey('Int')).toBe(true)
        expect(isScalarPrimitiveKey('Float')).toBe(true)
        expect(isScalarPrimitiveKey('DateTime')).toBe(false)
        expect(isScalarPrimitiveKey('Id')).toBe(false)
        expect(isScalarPrimitiveKey('int')).toBe(false)
    })

    test('detects only own custom scalar keys', () => {
        const inheritedScalars = Object.create({ DateTime: 'Date' }) as ConfigScalar
        inheritedScalars.JSON = '{ [key: string]: unknown }'

        expect(isScalarCustomKey('JSON', inheritedScalars)).toBe(true)
        expect(isScalarCustomKey('DateTime', inheritedScalars)).toBe(false)
    })

    test('resolves string custom scalars as-is', () => {
        expect(resolveCustomScalarTypeTs('Date')).toBe('Date')
        expect(resolveCustomScalarTypeTs('UserId', 'input')).toBe('UserId')
    })

    test('prefers matching custom scalar direction when both input and artifacts exist', () => {
        const scalar = {
            input: 'string',
            output: 'Date',
        }

        expect(resolveCustomScalarTypeTs(scalar, 'input')).toBe('string')
        expect(resolveCustomScalarTypeTs(scalar, 'output')).toBe('Date')
    })

    test('returns unknown for missing custom scalar direction in partial config', () => {
        expect(resolveCustomScalarTypeTs({ input: 'string' })).toBe('unknown')
        expect(resolveCustomScalarTypeTs({ output: 'Date' }, 'input')).toBe('unknown')
    })

    test('returns unknown for empty custom scalar object config', () => {
        expect(resolveCustomScalarTypeTs({})).toBe('unknown')
    })

    test('prefers custom scalar map entries over built-in scalars', () => {
        const customScalars: ConfigScalar = {
            String: { output: 'CustomString' },
            DateTime: 'Date',
        }

        expect(getScalarTsType('String', customScalars)).toBe('CustomString')
        expect(getScalarTsType('String', customScalars, 'input')).toBe('unknown')
        expect(getScalarTsType('DateTime', customScalars)).toBe('Date')
        expect(getScalarTsType('Int', customScalars)).toBe('number')
    })

    test('resolves custom scalar direction through getScalarTsType', () => {
        const customScalars: ConfigScalar = {
            DateTime: {
                input: 'string',
                output: 'Date',
            },
        }

        expect(getScalarTsType('DateTime', customScalars, 'input')).toBe('string')
        expect(getScalarTsType('DateTime', customScalars)).toBe('Date')
    })

    test('returns unknown through getScalarTsType when partial config misses requested direction', () => {
        const customScalars: ConfigScalar = {
            DateTime: {
                input: 'string',
            },
        }

        expect(getScalarTsType('DateTime', customScalars, 'input')).toBe('string')
        expect(getScalarTsType('DateTime', customScalars, 'output')).toBe('unknown')
    })

    test('returns unknown for scalar names not present in built-in or custom maps', () => {
        expect(getScalarTsType('MissingScalar')).toBe('unknown')
    })
})
