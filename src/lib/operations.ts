import type { OperationTypeNode } from 'graphql'
import type { Schema } from '../plugin-types'

export const getRootTypeForOperation = (
    operation: OperationTypeNode,
    schema: Schema
) => {
    switch (operation) {
        case 'query':
            return schema.getQueryType()
        case 'mutation':
            return schema.getMutationType()
        case 'subscription':
            return schema.getSubscriptionType()
    }
}
