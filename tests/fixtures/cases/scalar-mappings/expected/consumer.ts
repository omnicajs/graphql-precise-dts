import type {
    EventQueryPayload,
    EventQueryVariables,
} from 'queries/event.graphql'

import eventQuery from 'queries/event.graphql'

const variables: EventQueryVariables = {
    at: {
        metadata: {
            enabled: true,
            'source-id': 'fixture',
            value: { source: 'fixture' },
        },
        range: [ 1, null ],
        tags: [ 'graphql', null, 'typescript' ],
    },
}
const payload: EventQueryPayload = {
    event: {
        epoch: 1,
        iso: '1970-01-01T00:00:01.000Z',
        kind: 'timestamp',
        precision: 3,
        timezone: 'utc',
        verified: true,
    },
}

void eventQuery
void variables
void payload
