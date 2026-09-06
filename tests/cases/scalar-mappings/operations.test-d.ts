import type { EventQueryPayload, EventQueryVariables } from 'queries/event.graphql'
import type { Scalars } from '@app/graphql/schema'

import { expectTypeOf, test } from 'vitest'

test('preserves directional scalar structure and literal constraints', () => {
    expectTypeOf<EventQueryVariables['at']['range']>().toEqualTypeOf<[number, number | null]>()
    expectTypeOf<EventQueryPayload['event']['precision']>().toEqualTypeOf<3>()
    expectTypeOf<EventQueryPayload['event']['timezone']>().toEqualTypeOf<'utc' | 'local'>()
    expectTypeOf<Scalars['Timestamp']['input']>().toEqualTypeOf<EventQueryVariables['at']>()
    expectTypeOf<Scalars['Timestamp']['output']>().toEqualTypeOf<EventQueryPayload['event']>()
    // @ts-expect-error Timestamp output cannot be sent as Timestamp input.
    const wrongDirection: EventQueryVariables = { at: { epoch: 1, iso: '', kind: 'timestamp', precision: 3, verified: true, timezone: 'utc' } }
    // @ts-expect-error The scalar mapping requires the literal precision 3.
    const wrongPrecision: EventQueryPayload = { event: { epoch: 1, iso: '', kind: 'timestamp', precision: 2, verified: true, timezone: 'utc' } }
    void wrongDirection
    void wrongPrecision
})
