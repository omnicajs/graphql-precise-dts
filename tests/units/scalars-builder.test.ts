import type { ConfigScalars } from '../../src/config'

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
} from '../../src/scalars/builder'
import {
    namedType,
    nullType,
    numberType,
    renderType,
} from '../../src'
import { resolveCustomScalarTypeTs } from '../../src/scalars/builder'
import {
    stringType,
    unionOf,
} from '../../src'

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
        const inheritedScalars = Object.create({ DateTime: namedType('Date') }) as ConfigScalars
        inheritedScalars.JSON = namedType('JsonValue')

        expect(isScalarCustomKey('JSON', inheritedScalars)).toBe(true)
        expect(isScalarCustomKey('DateTime', inheritedScalars)).toBe(false)
    })

    test('resolves custom scalars as-is', () => {
        expect(renderType(resolveCustomScalarTypeTs(namedType('Date')))).toBe('Date')
        expect(renderType(resolveCustomScalarTypeTs(namedType('UserId'), 'input'))).toBe('UserId')
    })

    test('prefers matching custom scalar direction when both input and artifacts exist', () => {
        const scalar = {
            input: stringType(),
            output: namedType('Date'),
        }

        expect(renderType(resolveCustomScalarTypeTs(scalar, 'input'))).toBe('string')
        expect(renderType(resolveCustomScalarTypeTs(scalar, 'output'))).toBe('Date')
    })

    test('returns unknown for missing custom scalar direction in partial config', () => {
        expect(renderType(resolveCustomScalarTypeTs({ input: stringType() }))).toBe('unknown')
        expect(renderType(resolveCustomScalarTypeTs({ output: namedType('Date') }, 'input'))).toBe('unknown')
    })

    test('returns unknown for empty custom scalar object config', () => {
        expect(renderType(resolveCustomScalarTypeTs({}))).toBe('unknown')
    })

    test('prefers custom scalar map entries over built-in scalars', () => {
        const customScalars: ConfigScalars = {
            String: { output: namedType('CustomString') },
            DateTime: namedType('Date'),
        }

        expect(renderType(getScalarTsType('String', customScalars))).toBe('CustomString')
        expect(renderType(getScalarTsType('String', customScalars, 'input'))).toBe('unknown')
        expect(renderType(getScalarTsType('DateTime', customScalars))).toBe('Date')
        expect(getScalarTsType('Int', customScalars)).toEqual(numberType())
    })

    test('resolves custom scalar direction through getScalarTsType', () => {
        const customScalars: ConfigScalars = {
            DateTime: {
                input: stringType(),
                output: namedType('Date'),
            },
        }

        expect(renderType(getScalarTsType('DateTime', customScalars, 'input'))).toBe('string')
        expect(renderType(getScalarTsType('DateTime', customScalars))).toBe('Date')
    })

    test('returns unknown through getScalarTsType when partial config misses requested direction', () => {
        const customScalars: ConfigScalars = {
            DateTime: {
                input: stringType(),
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
                output: unionOf(namedType('Date'), nullType()),
            },
        }

        expect(renderType(getScalarTsType('DateTime', customScalars))).toBe('Date | null')
    })
})
