import type { ComposedQueryPayload } from 'composed.graphql'


import { test } from 'vitest'

test('composed-consumer preserves the consumer contract', () => {
    const payload: ComposedQueryPayload = {
        user: {
            id: 'user-1',
        },
    }

    const name: string | undefined = payload.user?.name

    void name
})
