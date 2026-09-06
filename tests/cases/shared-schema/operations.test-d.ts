import type { CustomerQueryPayload, CustomerQueryVariables } from 'queries/customer.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<CustomerQueryVariables>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<CustomerQueryPayload['customer']>().toEqualTypeOf<{ __typename?: 'Customer'; id: string; name: string }>()
    // @ts-expect-error The shared schema still requires a customer id.
    const invalid: CustomerQueryVariables = {}
    void invalid
})
