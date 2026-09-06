import type { TypeId } from '@/schema/types'
import type { SchemaView } from '@/schema/view'
import type { ASTNode } from 'graphql'

import {
    invalidDocument,
    unsupportedSchemaType,
} from './errors'

const expandConcreteTypes = (
    type: TypeId,
    schema: SchemaView
): ReadonlyArray<TypeId> => {
    const schemaType = schema.getType(type)

    if (schemaType.kind === 'object') return [ type ]
    if (schemaType.kind !== 'interface' && schemaType.kind !== 'union') return []

    return schema.getSubtypes(type)
        .flatMap(subtype => expandConcreteTypes(subtype, schema))
        .filter((subtype, index, subtypes) => subtypes.indexOf(subtype) === index)
        .sort()
}

export const getSelectionTypes = (
    type: TypeId,
    schema: SchemaView,
    node: ASTNode
): ReadonlyArray<TypeId> => {
    if (!schema.hasType(type)) {
        return invalidDocument(`Schema does not define type "${type}"`, node)
    }

    const possibleTypes = expandConcreteTypes(type, schema)

    if (!possibleTypes.length && schema.getType(type).kind === 'interface') {
        const interfaces = (id: TypeId): ReadonlyArray<TypeId> => [
            id,
            ...schema.getSubtypes(id).flatMap(interfaces),
        ]
        return interfaces(type)
    }

    if (!possibleTypes.length) {
        return unsupportedSchemaType(`Type "${type}" is not a supported composite output type`, node)
    }

    return possibleTypes
}

export const overlap = (
    left: ReadonlyArray<TypeId>,
    right: ReadonlyArray<TypeId>
): boolean => left.some(type => right.includes(type))
