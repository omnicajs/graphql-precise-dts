import {
    describe,
    expect,
    test,
} from 'vitest'

import { field } from '../fixtures/builders/declaration-render'
import { hasRootSpreadWithSameTypeNames } from '../../src/render/typename'
import { renderStringLiteralUnion } from '../../src/render/basic'
import { resolveTypenameSelection } from '../../src/render/typename'
import { typenameValue } from '../fixtures/builders/declaration-render'

describe('typename render helpers', () => {
    test('resolves conditional explicit typename as optional with fallback type names', () => {
        expect(resolveTypenameSelection([
            {
                ...field('__typename', typenameValue('UserPayload'), false),
                conditional: true,
                directives: [ 'include' ],
            },
        ], [ 'UserPayload', 'AdminPayload' ])).toEqual({
            present: true,
            required: false,
            typeNames: [ 'UserPayload', 'AdminPayload' ],
        })
    })

    test('detects matching root spreads and ignores conditional ones', () => {
        expect(hasRootSpreadWithSameTypeNames([{
            kind: 'fragmentSpread',
            name: 'UserDetails',
            onType: 'User',
            onTypeNames: [ 'UserPayload', 'AdminPayload' ],
        }], [ 'UserPayload', 'AdminPayload' ])).toBe(true)

        expect(hasRootSpreadWithSameTypeNames([{
            kind: 'fragmentSpread',
            name: 'UserDetails',
            onType: 'User',
            onTypeNames: [ 'UserPayload', 'AdminPayload' ],
            conditional: true,
        }], [ 'UserPayload', 'AdminPayload' ])).toBe(false)
    })

    test('renders string literal unions', () => {
        expect(renderStringLiteralUnion([ 'User', 'Guest' ])).toBe(`'User' | 'Guest'`)
    })
})
