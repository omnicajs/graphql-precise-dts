import type { ViewerQueryPayload } from 'viewer.graphql'

const payload: ViewerQueryPayload = {
    user: {
        id: 'user-1',
    },
}

const name: string | undefined = payload.user?.name

void name
