import type {
    TypeNode,
    VariableDefinitionNode,
} from 'graphql'
import type {
    SchemaInputValue,
    SchemaNonNullTypeRef,
    SchemaTypeRef,
} from '@/schema/types'
import type { CompilationContext } from './context'
import type {
    CompiledVariable,
    CompiledVariableUsage,
} from './model'

import { invalidDocument } from './errors'
import {
    compileInputValue,
    requireInputType,
} from './inputs'
import { getSourceLocation } from './diagnostics/location'
import { getNamedType } from '@/schema/ref'
import { Kind } from 'graphql'
import { validateValue } from './values'

export type VariableScope = {
    variables: ReadonlyArray<CompiledVariable>
    byName: ReadonlyMap<string, CompiledVariable>
    usages: CompiledVariableUsage[]
}

const toTypeRef = (type: TypeNode): SchemaTypeRef => {
    switch (type.kind) {
        case Kind.NAMED_TYPE:
            return {
                kind: 'named',
                type: type.name.value,
            }
        case Kind.LIST_TYPE:
            return {
                kind: 'list',
                ofType: toTypeRef(type.type),
            }
        case Kind.NON_NULL_TYPE:
            return {
                kind: 'non-null',
                ofType: toTypeRef(type.type) as SchemaNonNullTypeRef['ofType'],
            }
    }
}

const areCompatibleTypes = (
    variable: SchemaTypeRef,
    location: SchemaTypeRef
): boolean => {
    if (location.kind === 'non-null') {
        return variable.kind === 'non-null' && areCompatibleTypes(variable.ofType, location.ofType)
    }
    if (variable.kind === 'non-null') return areCompatibleTypes(variable.ofType, location)
    if (variable.kind === 'named') {
        return location.kind === 'named' && variable.type === location.type
    }
    if (location.kind === 'named') return false

    return areCompatibleTypes(variable.ofType, location.ofType)
}

export const isVariableAllowed = (
    variable: CompiledVariable,
    location: Pick<SchemaInputValue, 'defaultValue' | 'type'>
): boolean => {
    if (location.type.kind !== 'non-null' || variable.type.kind === 'non-null') {
        return areCompatibleTypes(variable.type, location.type)
    }

    const hasDefault = variable.hasNonNullDefault || location.defaultValue !== undefined

    return hasDefault && areCompatibleTypes(variable.type, location.type.ofType)
}

const compileVariable = (
    definition: VariableDefinitionNode,
    context: CompilationContext
): CompiledVariable => {
    const type = toTypeRef(definition.type)
    const name = definition.variable.name.value
    const typeId = getNamedType(type)

    if (!context.schema.hasType(typeId)) {
        return invalidDocument(`Schema does not define input type "${typeId}"`, definition.type)
    }
    requireInputType(type, context, getSourceLocation(definition))

    if (definition.defaultValue) {
        validateValue(
            definition.defaultValue,
            { type },
            context.schema,
            `Variable "$${name}" default value`
        )
    }

    return {
        name,
        type,
        optional: type.kind !== 'non-null' || definition.defaultValue !== undefined,
        hasNonNullDefault: definition.defaultValue !== undefined && definition.defaultValue.kind !== Kind.NULL,
        value: compileInputValue(type, context, new Set(), getSourceLocation(definition)),
        location: getSourceLocation(definition),
    }
}

export const compileVariables = (
    definitions: ReadonlyArray<VariableDefinitionNode>,
    context: CompilationContext
): VariableScope => {
    const variables: CompiledVariable[] = []
    const byName = new Map<string, CompiledVariable>()

    for (const definition of definitions) {
        const variable = compileVariable(definition, context)
        if (byName.has(variable.name)) {
            invalidDocument(`Variable "$${variable.name}" is defined more than once`, definition)
        }
        variables.push(variable)
        byName.set(variable.name, variable)
    }

    return {
        variables,
        byName,
        usages: [],
    }
}
