import {
    describe,
    expect,
    test,
} from 'vitest'

import { renderJsDoc } from '../../../src/render/jsdoc'

describe('JSDoc render', () => {
    test('renders single remarks and see values', () => {
        expect(renderJsDoc({
            remarks: 'Scalar reference: `Scalars[\'DateTime\'][\'output\']`.',
            see: 'https://scalars.graphql.org/andimarek/date-time.html',
        })).toBe([
            '/**',
            ' * @remarks Scalar reference: `Scalars[\'DateTime\'][\'output\']`.',
            ' * @see https://scalars.graphql.org/andimarek/date-time.html',
            ' */',
        ].join('\n'))
    })

    test('renders multiple remarks and see values', () => {
        expect(renderJsDoc({
            remarks: [
                'Scalar reference: `Scalars[\'DateTime\'][\'output\']`.',
                'Rendered as a configured scalar output type.',
            ],
            see: [
                'https://scalars.graphql.org/andimarek/date-time.html',
                'https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html',
            ],
        })).toBe([
            '/**',
            ' * @remarks Scalar reference: `Scalars[\'DateTime\'][\'output\']`.',
            ' * @remarks Rendered as a configured scalar output type.',
            ' * @see https://scalars.graphql.org/andimarek/date-time.html',
            ' * @see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html',
            ' */',
        ].join('\n'))
    })

    test('escapes comment terminators inside rows', () => {
        expect(renderJsDoc({
            description: 'Do not close */ the generated comment.',
        })).toBe('/** Do not close *\\/ the generated comment. */')
    })
})
