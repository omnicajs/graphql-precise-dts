import type { ComposedQueryPayload } from 'composed.graphql'

const payload: ComposedQueryPayload = {
    user: {
        id: 'user-1',
    },
}

const name: string | undefined = payload.user?.name

void name
