import type { ConditionalNodeQueryPayload } from 'abstract.graphql'


import { test } from 'vitest'

test('abstract-consumer preserves the consumer contract', () => {
    const withB: ConditionalNodeQueryPayload = {
        node: {
            __typename: 'B',
            b: 'value',
        },
    }

    const skipped: ConditionalNodeQueryPayload = {
        node: {
            __typename: 'B',
        },
    }

    void withB
    void skipped
})
