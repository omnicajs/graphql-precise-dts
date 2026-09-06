import type { ViewerQueryPayload } from 'viewer.graphql'


import { test } from 'vitest'

test('consumer preserves the consumer contract', () => {
    const payload: ViewerQueryPayload = {
        user: {
            id: 'user-1',
        },
    }

    const name: string | undefined = payload.user?.name

    void name
})
