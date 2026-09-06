import type { DirectiveEffectsQueryPayload } from 'directives.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<DirectiveEffectsQueryPayload['date']>().toEqualTypeOf<string>()
    expectTypeOf<`${DirectiveEffectsQueryPayload['user']['status']}`>().toEqualTypeOf<'ACTIVE' | 'INACTIVE'>()
    // @ts-expect-error @required removes null from the selected user.
    const nullableUser: DirectiveEffectsQueryPayload = { date: '', user: null }
    void nullableUser
})
