import type {
    PlannedFieldSelectionModel,
    PlannedFragmentSpreadSelectionModel,
} from '../../../src/plan/planned/types'

import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    hasAliasedRootTypenameSelection,
    hasRootSpreadWithSameTypeNames,
    resolveTypenameSelection,
} from '../../../src/plan/renderable/shapes'
import { renderStringLiteralUnion } from '../../../src/render/basic'
import { namedType } from '../../fixtures/builders/declaration-render'

import {
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'

const plannedTypenameField = (
    ...typeNames: string[]
): PlannedFieldSelectionModel => ({
    kind: SELECTION_MODEL_KIND.FIELD,
    name: '__typename',
    responseName: '__typename',
    argumentsSignature: '',
    conditional: false,
    typeRef: namedType(false),
    value: {
        kind: VALUE_MODEL_KIND.TYPENAME,
        typeNames,
    },
})

const plannedFragmentSpread = (
    typeNames: string[],
    conditional = false,
    name = 'UserDetails'
): PlannedFragmentSpreadSelectionModel => ({
    kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
    name,
    onType: 'User',
    onTypeNames: typeNames,
    conditional,
})

describe('declaration shape helpers', () => {
    test('resolves conditional explicit typename as optional with fallback type names', () => {
        expect(resolveTypenameSelection([
            {
                ...plannedTypenameField('UserPayload'),
                conditional: true,
                directives: [ 'include' ],
            },
        ], [ 'UserPayload', 'AdminPayload' ])).toEqual({
            present: true,
            required: false,
            typeNames: [ 'UserPayload', 'AdminPayload' ],
        })
    })

    test('resolves mixed explicit typename selections against fallback type names', () => {
        expect(resolveTypenameSelection([
            plannedTypenameField('UserPayload'),
            {
                ...plannedTypenameField('AdminPayload'),
                conditional: true,
                directives: [ 'include' ],
            },
        ], [ 'UserPayload', 'AdminPayload' ])).toEqual({
            present: true,
            required: false,
            typeNames: [ 'UserPayload', 'AdminPayload' ],
        })

        expect(resolveTypenameSelection([
            plannedTypenameField('UserPayload'),
            plannedTypenameField('AdminPayload'),
        ], [ 'UserPayload', 'AdminPayload' ])).toEqual({
            present: true,
            required: true,
            typeNames: [ 'UserPayload', 'AdminPayload' ],
        })
    })

    test('detects matching root spreads only when every spread is non-conditional and matches the same type names', () => {
        expect(hasRootSpreadWithSameTypeNames([
            plannedFragmentSpread([ 'UserPayload', 'AdminPayload' ]),
        ], [ 'UserPayload', 'AdminPayload' ])).toBe(true)

        expect(hasRootSpreadWithSameTypeNames([
            plannedFragmentSpread([ 'UserPayload', 'AdminPayload' ], true),
        ], [ 'UserPayload', 'AdminPayload' ])).toBe(false)

        expect(hasRootSpreadWithSameTypeNames([
            plannedFragmentSpread([ 'UserPayload', 'AdminPayload' ]),
            plannedFragmentSpread([ 'UserPayload', 'AdminPayload' ], false, 'OwnerDetails'),
        ], [ 'UserPayload', 'AdminPayload' ])).toBe(true)

        expect(hasRootSpreadWithSameTypeNames([
            plannedFragmentSpread([ 'UserPayload', 'AdminPayload' ]),
            plannedFragmentSpread([ 'UserPayload' ], false, 'OwnerDetails'),
        ], [ 'UserPayload', 'AdminPayload' ])).toBe(false)
    })

    test('detects non-conditional aliased typename selections in the current selection set', () => {
        expect(hasAliasedRootTypenameSelection([{
            ...plannedTypenameField('UserPayload'),
            responseName: 'kind',
        }])).toBe(true)

        expect(hasAliasedRootTypenameSelection([{
            ...plannedTypenameField('UserPayload'),
            responseName: 'kind',
            conditional: true,
            directives: [ 'include' ],
        }])).toBe(false)
    })

    test('renders string literal unions', () => {
        expect(renderStringLiteralUnion([ 'User', 'Guest' ])).toBe(`'User' | 'Guest'`)
    })
})
