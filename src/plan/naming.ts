import type { NamingConvention } from '../naming'
import type { OperationTypeNode } from 'graphql'

import { capitalize } from '../lib/strings'

export const getOperationTypeName = (
    operationName: string,
    operationType: OperationTypeNode,
    naming?: NamingConvention
): string => naming
    ? naming.operationTypeName(operationName, operationType)
    : capitalize(operationName) + capitalize(operationType)
