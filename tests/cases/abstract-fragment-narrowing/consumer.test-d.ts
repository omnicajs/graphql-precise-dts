import type { OnlyAQueryPayload } from 'only-a.graphql'


import { test } from 'vitest'

test('consumer preserves the consumer contract', () => {
    const valid: OnlyAQueryPayload = {
        onlyA: {
            id: 'parent',
            a: 'parent',
            child: {
                id: 'child',
                a: 'child',
            },
        },
    }

    const invalidParent: OnlyAQueryPayload = {
        onlyA: {
            id: 'parent',
            // @ts-expect-error Only the A branch can be returned by Query.onlyA.
            b: 'wrong parent type',
            child: {
                id: 'child',
                a: 'child',
            },
        },
    }

    const invalidChild: OnlyAQueryPayload = {
        onlyA: {
            id: 'parent',
            a: 'parent',
            child: {
                id: 'child',
                // @ts-expect-error A.child is covariant and can only return A.
                b: 'wrong child type',
            },
        },
    }

    void valid
    void invalidParent
    void invalidChild
})
