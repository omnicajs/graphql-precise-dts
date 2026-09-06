import type { UserQueryPayload, UserQueryVariables } from 'queries/user.graphql'
import type { BothSkippedQueryPayload, SkippedFirstQueryPayload } from 'queries/skipped.graphql'

import { expectTypeOf, test } from 'vitest'

test('merges fields without weakening unconditional selections', () => {
    expectTypeOf<UserQueryVariables>().toEqualTypeOf<{ id: string; withName: boolean }>()
    expectTypeOf<UserQueryPayload['user']['name']>().toEqualTypeOf<string>()
    expectTypeOf<UserQueryPayload['user']['conditionalNickname']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<keyof BothSkippedQueryPayload['user']>().toEqualTypeOf<'__typename'>()
    // @ts-expect-error A skipped occurrence cannot erase id from the selected occurrence.
    const missingId: SkippedFirstQueryPayload = { user: {} }
    void missingId
})
