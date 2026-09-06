import type { ViewerQueryPayload, ViewerQueryVariables } from 'queries/viewer.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<ViewerQueryVariables>().toEqualTypeOf<{ id: string; details: boolean }>()
    type User = Extract<ViewerQueryPayload['node'], { __typename?: 'User' }>
    expectTypeOf<User['profile']['nickname']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<User['profile']['displayName']>().toEqualTypeOf<string>()
    const selected: ViewerQueryPayload = { node: { __typename: 'User', id: '1', name: 'Ada', profile: { displayName: 'Ada' } } }
    // @ts-expect-error The unconditional profile selection still requires displayName.
    const incomplete: User = { id: '1', name: 'Ada', profile: {} }
    void selected; void incomplete
})
