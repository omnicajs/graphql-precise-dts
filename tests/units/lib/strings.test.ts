import {
    describe,
    expect,
    test,
} from 'vitest'

import {
    capitalize,
    indent,
    uncapitalize,
} from '../../../src/lib/strings'

describe('string helpers', () => {
    test('capitalizes the first character', () => {
        expect(capitalize('user')).toBe('User')
    })

    test('keeps empty values unchanged when capitalizing', () => {
        expect(capitalize('')).toBe('')
    })

    test('uncapitalizes the first character', () => {
        expect(uncapitalize('User')).toBe('user')
    })

    test('keeps empty values unchanged when uncapitalizing', () => {
        expect(uncapitalize('')).toBe('')
    })

    test('indents each line with one tab by default', () => {
        expect(indent('type User = {\nid: string\n}')).toBe([
            '\ttype User = {',
            '\tid: string',
            '\t}',
        ].join('\n'))
    })

    test('indents each line with custom padding and level', () => {
        expect(indent('id: string\nname: string', 2, '  ')).toBe([
            '    id: string',
            '    name: string',
        ].join('\n'))
    })
})
