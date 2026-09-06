import type { DashboardQueryPayload } from 'queries/dashboard.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<DashboardQueryPayload['dashboard']>().toEqualTypeOf<{ __typename?: 'CoreDashboard'; openOrders: number }>()
    // @ts-expect-error A schema target must not inherit the other target's fields.
    const otherSchema: DashboardQueryPayload = { dashboard: { activeVisitors: 1 } }
    void otherSchema
})
