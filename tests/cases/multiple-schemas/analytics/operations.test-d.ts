import type { DashboardQueryPayload } from 'queries/dashboard.graphql'

import { expectTypeOf, test } from 'vitest'

test('preserves the documented operation contract', () => {
    expectTypeOf<DashboardQueryPayload['dashboard']>().toEqualTypeOf<{ __typename?: 'AnalyticsDashboard'; activeVisitors: number }>()
    // @ts-expect-error A schema target must not inherit the other target's fields.
    const otherSchema: DashboardQueryPayload = { dashboard: { openOrders: 1 } }
    void otherSchema
})
