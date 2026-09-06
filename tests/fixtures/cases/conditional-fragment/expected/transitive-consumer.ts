import type { TransitiveQueryPayload } from 'transitive.graphql'

const payload: TransitiveQueryPayload = {
    user: {
        id: 'user-1',
    },
}

const name: string | undefined = payload.user?.name

void name
