import type { OperationTypeNode } from 'graphql'

import { capitalize } from './strings'

export const getOperationTypeName = (
    operationName: string,
    operationType: OperationTypeNode
): string => capitalize(operationName) + capitalize(operationType)
