import type { ASTNode } from 'graphql'
import type { SourceLocation } from '../types'

import { getLocation } from 'graphql'

export const getSourceLocation = (
    node: ASTNode
): SourceLocation => getLocation(node.loc!.source, node.loc!.start)
