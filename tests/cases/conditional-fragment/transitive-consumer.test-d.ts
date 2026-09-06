import type { TransitiveQueryPayload } from 'transitive.graphql'


import { test } from 'vitest'

test('transitive-consumer preserves the consumer contract', () => {
    const payload: TransitiveQueryPayload = {
        user: {
            id: 'user-1',
        },
    }

    const name: string | undefined = payload.user?.name

    void name
})
