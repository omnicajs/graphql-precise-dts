import {
    describe,
    expect,
    test,
} from 'vitest'

import { createNameAllocator } from '../../../src/plan/planned/name-allocator'

describe('name allocator', () => {
    test('allocates hash-suffixed names only when the base name is occupied', () => {
        const allocator = createNameAllocator()

        expect(allocator('UserAlias', 'user-shape')).toBe('UserAlias')
        expect(allocator('UserAlias', 'other-user-shape')).toMatch(/^UserAlias_[a-f0-9]{4}$/)
    })

    test('falls back to indexed full-hash names when every hash prefix is occupied', () => {
        const allocator = createNameAllocator([ 'UserAlias' ])
        const allocatedNames = Array.from({ length: 5 }, () =>
            allocator('UserAlias', 'user-shape')
        )
        const fullHashName = allocatedNames[allocatedNames.length - 1]

        expect(allocatedNames).toEqual([
            expect.stringMatching(/^UserAlias_[a-f0-9]{4}$/),
            expect.stringMatching(/^UserAlias_[a-f0-9]{5}$/),
            expect.stringMatching(/^UserAlias_[a-f0-9]{6}$/),
            expect.stringMatching(/^UserAlias_[a-f0-9]{7}$/),
            expect.stringMatching(/^UserAlias_[a-f0-9]{8}$/),
        ])

        expect(allocator('UserAlias', 'user-shape')).toBe(`${fullHashName}2`)
        expect(allocator('UserAlias', 'user-shape')).toBe(`${fullHashName}3`)
    })
})
