import type { ApolloClient } from '@apollo/client'
import type { UserDetails } from '~tests/fixtures/documents/fragments/UserDetails.graphql'
import type { UserQueryVariables } from '~tests/fixtures/documents/queries/user.graphql'
import type { CreateUserMutationVariables } from '~tests/fixtures/documents/mutations/createUser.graphql'

import { userQuery } from '~tests/fixtures/documents/queries/user.graphql'
import { ownerGroupChangedSubscription } from '~tests/fixtures/documents/subscriptions/ownerGroupChanged.graphql'

import { test } from 'vitest'

declare const client: ApolloClient
declare const user: UserDetails

test('rejects invalid operation consumers', () => {
    // @ts-expect-error A required ID variable cannot be omitted.
    const missingId: UserQueryVariables = {}
    // @ts-expect-error The scalar ID mapping requires a string.
    const numericId: UserQueryVariables = { id: 1 }
    // @ts-expect-error The mutation input requires a username.
    const missingUsername: CreateUserMutationVariables = { input: { name: 'user' } }

    client.query({
        query: userQuery,
        // @ts-expect-error Apollo infers the operation variables from TypedDocumentNode.
        variables: { id: 1 },
    })
    client.subscribe({
        query: ownerGroupChangedSubscription,
        // @ts-expect-error Subscription variables retain the schema ID mapping.
        variables: { groupId: false },
    })

    // @ts-expect-error Nullable selected fields cannot be assumed to contain strings.
    const requiredFirstName: string = user.firstName
    // @ts-expect-error Unselected fields do not become available through the schema type.
    void user.permissions

    void missingId
    void numericId
    void missingUsername
    void requiredFirstName
})
