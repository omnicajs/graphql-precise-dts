import type { NamingConvention } from '../generation/naming'
import type { OperationTypeNode } from 'graphql'

import { capitalize } from '../strings'

export const getOperationTypeName = (
    operationName: string,
    operationType: OperationTypeNode,
    naming?: NamingConvention
): string => naming
    ? naming.operationTypeName(operationName, operationType)
    : capitalize(operationName) + capitalize(operationType)
