import type {
    BothSkippedQueryPayload,
    NestedSelectedFirstQueryPayload,
    NestedSkippedFirstQueryPayload,
    SelectedFirstQueryPayload,
    SkippedFirstQueryPayload,
} from 'queries/skipped.graphql'


import { test } from 'vitest'

test('consumer preserves the consumer contract', () => {
    const skippedFirst: SkippedFirstQueryPayload = {
        user: { id: 'user-1' },
    }
    const selectedFirst: SelectedFirstQueryPayload = {
        user: { id: 'user-1' },
    }
    const bothSkipped: BothSkippedQueryPayload = {
        user: {},
    }
    const nestedSkippedFirst: NestedSkippedFirstQueryPayload = {
        user: {
            friend: { id: 'friend-1' },
        },
    }
    const nestedSelectedFirst: NestedSelectedFirstQueryPayload = {
        user: {
            friend: { id: 'friend-1' },
        },
    }

    const skippedFirstId: string = skippedFirst.user.id
    const selectedFirstId: string = selectedFirst.user.id

    void skippedFirstId
    void selectedFirstId
    void bothSkipped
    void nestedSkippedFirst
    void nestedSelectedFirst
})
