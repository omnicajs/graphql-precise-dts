import type { ConditionalNodeQueryPayload } from 'abstract.graphql'

const withB: ConditionalNodeQueryPayload = {
    node: {
        __typename: 'B',
        b: 'value',
    },
}

const skipped: ConditionalNodeQueryPayload = {
    node: {
        __typename: 'B',
    },
}

void withB
void skipped
