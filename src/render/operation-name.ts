import type { OperationTypeNode } from 'graphql'

import { capitalize } from '../lib/strings'

export const getOperationTypeName = (
    operationName: string,
    operationType: OperationTypeNode
): string => capitalize(operationName) + capitalize(operationType)
