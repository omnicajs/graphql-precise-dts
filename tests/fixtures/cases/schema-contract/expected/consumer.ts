import type {
    SearchQueryPayload,
    SearchQueryVariables,
} from 'queries/search.graphql'

import searchQuery from 'queries/search.graphql'

const variables: SearchQueryVariables = {
    filter: { term: 'precise types' },
    range: { from: 1, to: null },
}
const payload: SearchQueryPayload = {
    __typename: 'Query',
    search: [{
        __typename: 'Team',
        id: 'team-1',
        title: 'GraphQL tooling',
    }],
}

void searchQuery
void variables
void payload
