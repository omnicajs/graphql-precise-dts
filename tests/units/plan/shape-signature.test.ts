import {
    describe,
    expect,
    test,
} from 'vitest'

import { defineString } from '../../../src'

import {
    enumValue,
    field,
    scalar,
    unionValue,
    variableField,
    variableObjectValue,
    variableScalar,
} from '../../fixtures/builders/declaration-render'

import {
    makeOutputShapeSignature,
    makeVariableShapeSignature,
} from '../../../src/plan/planned/normalize/shape-signature'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'

describe('shape signatures', () => {
    test('includes enum variable values in variable signatures', () => {
        expect(makeVariableShapeSignature({
            kind: VALUE_MODEL_KIND.ENUM,
            name: 'Role',
        })).toBe('enum:Role')
    })

    test('includes unknown variable values in variable signatures', () => {
        expect(makeVariableShapeSignature({
            kind: VALUE_MODEL_KIND.UNKNOWN,
            reason: 'unsupported-variable',
        })).toBe('unknown:unsupported-variable')
    })

    test('uses anonymous as the default variable object type name', () => {
        expect(makeVariableShapeSignature(variableObjectValue([
            variableField('value', variableScalar(defineString()), false),
        ]))).toBe(
            'object:anonymous|value:required:nonnull:named:Ignored:scalar:FixtureScalar_input_string:input'
        )
    })

    test('includes required fallback typename in output signatures', () => {
        expect(makeOutputShapeSignature([
            field('name', scalar(defineString()), false),
        ], [ 'User' ], {
            requiredFallbackTypename: true,
        })).toBe([
            'types:User',
            'field:name:name::required:nonnull:named:Ignored:scalar:FixtureScalar_output_string:output|required-fallback-typename',
        ].join('::'))
    })

    test('includes conditional fragment spreads in output signatures', () => {
        expect(makeOutputShapeSignature([{
            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
            name: 'UserDetails',
            onType: 'User',
            conditional: true,
        }], [ 'User' ], {})).toBe([
            'types:User',
            'spread:UserDetails:User:conditional',
        ].join('::'))
    })

    test('includes union field values in output signatures', () => {
        expect(makeOutputShapeSignature([
            field('result', unionValue([
                {
                    typeName: 'Group',
                    fields: [
                        field('name', scalar(defineString()), false),
                    ],
                },
                {
                    typeName: 'User',
                    fields: [
                        field('role', enumValue('Role'), false),
                    ],
                },
            ]), false),
        ], [ 'Query' ], {})).toBe([
            'types:Query',
            'field:result:result::required:nonnull:named:Ignored:union:Group:field:name:name::required:nonnull:named:Ignored:scalar:FixtureScalar_output_string:output|User:field:role:role::required:nonnull:named:Ignored:enum:Role',
        ].join('::'))
    })

    test('includes unknown field values in output signatures', () => {
        expect(makeOutputShapeSignature([
            field('mystery', {
                kind: VALUE_MODEL_KIND.UNKNOWN,
                reason: 'unsupported-field',
            }, false),
        ], [ 'Query' ], {})).toBe([
            'types:Query',
            'field:mystery:mystery::required:nonnull:named:Ignored:unknown:unsupported-field',
        ].join('::'))
    })
})
