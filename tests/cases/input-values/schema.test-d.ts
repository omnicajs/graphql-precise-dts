import type { Query, Scalars } from '@search/graphql/schema'

import { expectTypeOf, test } from 'vitest'

test('preserves schema field types and built-in scalar directions', () => {
    expectTypeOf<Scalars['Boolean']>().toEqualTypeOf<{ input: boolean; output: boolean }>()
    expectTypeOf<Query['search']>().toEqualTypeOf<boolean>()
    // @ts-expect-error A schema output remains an object with declared fields.
    const invalid: Query = 'invalid output'
    void invalid
})
