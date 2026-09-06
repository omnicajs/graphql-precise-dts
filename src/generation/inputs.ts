import type {
    SchemaInputType,
    SchemaTypeRef,
    TypeId,
} from '@/schema/types'
import type { SourceLocation } from './types'
import type { CompilationContext } from './context'
import type {
    CompiledInputField,
    CompiledInputValue,
} from './model'

import { getNamedType } from '@/schema/ref'
import { unsupportedSchemaType } from './errors'
import {
    getScalarType,
    hasScalarMapping,
} from './scalars'

const compileInputFields = (
    schemaType: Extract<ReturnType<CompilationContext['schema']['getType']>, { kind: 'input-object' }>,
    context: CompilationContext,
    ancestors: ReadonlySet<TypeId>,
    location: SourceLocation
): ReadonlyArray<CompiledInputField> => {
    const path = new Set(ancestors).add(schemaType.id)

    return schemaType.fields.map(field => ({
        name: field.name,
        type: field.type,
        optional: field.type.kind !== 'non-null' || field.defaultValue !== undefined,
        value: compileInputValue(field.type, context, path, location),
    }))
}

export const requireInputType = (
    type: SchemaTypeRef,
    context: CompilationContext,
    location: SourceLocation
): SchemaInputType => {
    const schemaType = context.schema.getType(getNamedType(type))
    if (schemaType.kind === 'scalar'
        || schemaType.kind === 'enum'
        || schemaType.kind === 'input-object') return schemaType

    return unsupportedSchemaType(
        `Type "${schemaType.id}" of kind "${schemaType.kind}" cannot be used as input`,
        location
    )
}

export const compileInputValue = (
    type: SchemaTypeRef,
    context: CompilationContext,
    ancestors: ReadonlySet<TypeId>,
    location: SourceLocation
): CompiledInputValue => {
    const schemaType = requireInputType(type, context, location)

    if (schemaType.kind === 'scalar') {
        const scalarType = getScalarType(schemaType.id, context.scalars, 'input')
        if (!scalarType) {
            return unsupportedSchemaType(hasScalarMapping(context.scalars, schemaType.id)
                ? `Scalar "${schemaType.id}" does not define an input mapping`
                : `Scalar "${schemaType.id}" is not supported yet`, location)
        }

        return {
            kind: 'scalar',
            type: scalarType,
        }
    }

    if (schemaType.kind === 'enum') {
        return {
            kind: 'enum',
            type: schemaType.id,
        }
    }

    if (ancestors.has(schemaType.id)) {
        return {
            kind: 'input-reference',
            type: schemaType.id,
        }
    }

    return {
        kind: 'input-object',
        type: schemaType.id,
        oneOf: schemaType.oneOf,
        fields: compileInputFields(schemaType, context, ancestors, location),
    }
}
