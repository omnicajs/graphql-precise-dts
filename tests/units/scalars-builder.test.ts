import type { ConfigScalars } from '../../src/config'

import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    defineNamed,
    defineNull,
    defineNumber,
    defineString,
    renderType,
    unionOf,
} from '../../src'

import {
    getScalarPrimitiveTypeTs,
    getScalarTsType,
    isScalarCustomKey,
    isScalarPrimitiveKey,
    resolveCustomScalarTypeTs,
} from '../../src/scalars/builder'

describe('converting graphQL scalars to TS types', () => {
    test('resolves built-in scalar artifacts types', () => {
        expect(renderType(getScalarPrimitiveTypeTs('ID'))).toBe('string')
        expect(renderType(getScalarPrimitiveTypeTs('String'))).toBe('string')
        expect(renderType(getScalarPrimitiveTypeTs('Boolean'))).toBe('boolean')
        expect(renderType(getScalarPrimitiveTypeTs('Int'))).toBe('number')
        expect(renderType(getScalarPrimitiveTypeTs('Float'))).toBe('number')
    })

    test('resolves built-in scalar input types explicitly', () => {
        expect(renderType(getScalarPrimitiveTypeTs('ID', 'input'))).toBe('string')
        expect(renderType(getScalarPrimitiveTypeTs('String', 'input'))).toBe('string')
        expect(renderType(getScalarPrimitiveTypeTs('Boolean', 'input'))).toBe('boolean')
        expect(renderType(getScalarPrimitiveTypeTs('Int', 'input'))).toBe('number')
        expect(renderType(getScalarPrimitiveTypeTs('Float', 'input'))).toBe('number')
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
        const inheritedScalars = Object.create({ DateTime: defineNamed('Date') }) as ConfigScalars
        inheritedScalars.JSON = defineNamed('JsonValue')

        expect(isScalarCustomKey('JSON', inheritedScalars)).toBe(true)
        expect(isScalarCustomKey('DateTime', inheritedScalars)).toBe(false)
    })

    test('resolves custom scalars as-is', () => {
        expect(renderType(resolveCustomScalarTypeTs(defineNamed('Date')))).toBe('Date')
        expect(renderType(resolveCustomScalarTypeTs(defineNamed('UserId'), 'input'))).toBe('UserId')
    })

    test('prefers matching custom scalar direction when both input and artifacts exist', () => {
        const scalar = {
            input: defineString(),
            output: defineNamed('Date'),
        }

        expect(renderType(resolveCustomScalarTypeTs(scalar, 'input'))).toBe('string')
        expect(renderType(resolveCustomScalarTypeTs(scalar, 'output'))).toBe('Date')
    })

    test('returns unknown for missing custom scalar direction in partial config', () => {
        expect(renderType(resolveCustomScalarTypeTs({ input: defineString() }))).toBe('unknown')
        expect(renderType(resolveCustomScalarTypeTs({ output: defineNamed('Date') }, 'input'))).toBe('unknown')
    })

    test('returns unknown for empty custom scalar object config', () => {
        expect(renderType(resolveCustomScalarTypeTs({}))).toBe('unknown')
    })

    test('prefers custom scalar map entries over built-in scalars', () => {
        const customScalars: ConfigScalars = {
            String: { output: defineNamed('CustomString') },
            DateTime: defineNamed('Date'),
        }

        expect(renderType(getScalarTsType('String', customScalars))).toBe('CustomString')
        expect(renderType(getScalarTsType('String', customScalars, 'input'))).toBe('unknown')
        expect(renderType(getScalarTsType('DateTime', customScalars))).toBe('Date')
        expect(getScalarTsType('Int', customScalars)).toEqual(defineNumber())
    })

    test('resolves custom scalar direction through getScalarTsType', () => {
        const customScalars: ConfigScalars = {
            DateTime: {
                input: defineString(),
                output: defineNamed('Date'),
            },
        }

        expect(renderType(getScalarTsType('DateTime', customScalars, 'input'))).toBe('string')
        expect(renderType(getScalarTsType('DateTime', customScalars))).toBe('Date')
    })

    test('returns unknown through getScalarTsType when partial config misses requested direction', () => {
        const customScalars: ConfigScalars = {
            DateTime: {
                input: defineString(),
            },
        }

        expect(renderType(getScalarTsType('DateTime', customScalars, 'input'))).toBe('string')
        expect(renderType(getScalarTsType('DateTime', customScalars, 'output'))).toBe('unknown')
    })

    test('returns unknown for scalar names not present in built-in or custom maps', () => {
        expect(renderType(getScalarTsType('MissingScalar'))).toBe('unknown')
    })

    test('accepts structured scalar config without string parsing', () => {
        const customScalars: ConfigScalars = {
            DateTime: {
                output: unionOf(defineNamed('Date'), defineNull()),
            },
        }

        expect(renderType(getScalarTsType('DateTime', customScalars))).toBe('Date | null')
    })
})
