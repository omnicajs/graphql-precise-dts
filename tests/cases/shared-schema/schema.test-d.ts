import type { Query, Scalars } from '@app/graphql/schema'

import { expectTypeOf, test } from 'vitest'

test('preserves schema field types and built-in scalar directions', () => {
    expectTypeOf<Scalars['Boolean']>().toEqualTypeOf<{ input: boolean; output: boolean }>()
    expectTypeOf<Query['customer']['name']>().toEqualTypeOf<string>()
    // @ts-expect-error A schema output remains an object with declared fields.
    const invalid: Query = 'invalid output'
    void invalid
})
