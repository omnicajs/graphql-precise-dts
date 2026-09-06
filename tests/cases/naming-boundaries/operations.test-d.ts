import type { FetchHttp2UsersQueryPayload } from 'queries/users.graphql'
import type { FetchMgBotsQueryPayload } from 'queries/bots-query.graphql'
import type { ___QueryPayload } from 'queries/underscores.graphql'
import type { StatusQueryPayload } from 'queries/status.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<FetchHttp2UsersQueryPayload['users']>().toEqualTypeOf<string>()
    expectTypeOf<FetchMgBotsQueryPayload['users']>().toEqualTypeOf<string>()
    expectTypeOf<___QueryPayload['ok']>().toEqualTypeOf<boolean>()
    expectTypeOf<`${StatusQueryPayload['status']}`>().toEqualTypeOf<'active'>()
    // @ts-expect-error Operation naming must not change a field type.
    const invalid: ___QueryPayload = { ok: 'yes' }
    void invalid
})
