import type { CustomScalarMappingRecord } from '../../scalars/types'
import type { NameAllocator } from './name-allocator'
import type { NamingConvention } from '../../naming'

import type {
    OperationModel,
    VariableField,
    VariableValue,
} from '../../models/types'

import type {
    PlannedVariableAlias,
    PlannedVariableField,
    PlannedVariableObjectValue,
    PlannedVariableValue,
} from './types'

import { buildScalarValue } from './shared'
import { createNamingConvention } from '../../naming'
import { makeVariableShapeSignature } from './normalize/shape-signature'

import { VALUE_MODEL_KIND } from '../../kinds'

export type VariableBuildState = {
    cache: Map<string, PlannedVariableObjectValue>;
    inProgress: Set<string>;
    aliasNames: Map<string, string>;
    aliasSignaturesByTypeName: Map<string, string>;
    nameAllocator: NameAllocator;
    naming: NamingConvention;
}

export const createVariableBuildState = (
    nameAllocator: NameAllocator,
    naming: NamingConvention = createNamingConvention()
): VariableBuildState => ({
    cache: new Map(),
    inProgress: new Set(),
    aliasNames: new Map(),
    aliasSignaturesByTypeName: new Map(),
    nameAllocator,
    naming,
})

const getAllocatedVariableAliasName = (
    typeName: string,
    state: VariableBuildState
): string => {
    const cachedAliasName = state.aliasNames.get(typeName)
    if (cachedAliasName) return cachedAliasName

    const aliasName = state.nameAllocator(
        state.naming.variableAliasName(typeName),
        state.aliasSignaturesByTypeName.get(typeName) ?? typeName
    )
    state.aliasNames.set(typeName, aliasName)

    return aliasName
}

const buildVariableValue = (
    value: VariableValue,
    state: VariableBuildState,
    customScalars: CustomScalarMappingRecord
): PlannedVariableValue => {
    if (value.kind === VALUE_MODEL_KIND.SCALAR) {
        return buildScalarValue(value, customScalars)
    }

    if (value.kind !== VALUE_MODEL_KIND.OBJECT) return value

    if (value.typeName && value.isRecursiveReference) {
        return {
            kind: VALUE_MODEL_KIND.OBJECT,
            typeName: value.typeName,
            fields: [],
            renderAliasName: getAllocatedVariableAliasName(value.typeName, state),
            renderAsReference: true,
        }
    }

    if (value.typeName) {
        const cached = state.cache.get(value.typeName)
        if (cached) return cached

        if (state.inProgress.has(value.typeName)) {
            return {
                kind: VALUE_MODEL_KIND.OBJECT,
                typeName: value.typeName,
                fields: [],
                renderAliasName: getAllocatedVariableAliasName(value.typeName, state),
                renderAsReference: true,
            }
        }
    }

    const node: PlannedVariableObjectValue = {
        kind: VALUE_MODEL_KIND.OBJECT,
        typeName: value.typeName,
        fields: [],
    }

    if (value.typeName) {
        state.inProgress.add(value.typeName)
        state.cache.set(value.typeName, node)
    }

    node.fields = value.fields.map(field => buildVariableField(field, state, customScalars))

    if (value.typeName) {
        state.inProgress.delete(value.typeName)
    }

    return node
}

export const buildVariableField = (
    field: VariableField,
    state: VariableBuildState,
    customScalars: CustomScalarMappingRecord
): PlannedVariableField => ({
    ...field,
    value: buildVariableValue(field.value, state, customScalars),
})

const collectVariableDefinitionsFromValue = (
    value: VariableValue,
    requiredTypeNames: Set<string>,
    definitions: Map<string, Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>
) => {
    if (value.kind !== VALUE_MODEL_KIND.OBJECT) return

    if (value.typeName) {
        if (value.isRecursiveReference) {
            requiredTypeNames.add(value.typeName)
            return
        }

        definitions.set(value.typeName, value)
    }

    value.fields.forEach(field => collectVariableDefinitionsFromValue(field.value, requiredTypeNames, definitions))
}

const collectVariableDefinitions = (operations: Map<string, OperationModel>) => {
    const requiredTypeNames = new Set<string>()
    const definitions = new Map<string, Extract<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>()

    operations.forEach(operation => {
        operation.variables.forEach(variable => collectVariableDefinitionsFromValue(variable.value, requiredTypeNames, definitions))
    })

    return { requiredTypeNames, definitions }
}

export const buildVariableAliases = (
    operations: Map<string, OperationModel>,
    state: VariableBuildState,
    customScalars: CustomScalarMappingRecord
): PlannedVariableAlias[] => {
    const { requiredTypeNames, definitions } = collectVariableDefinitions(operations)

    definitions.forEach((definition, typeName) => {
        state.aliasSignaturesByTypeName.set(typeName, makeVariableShapeSignature(definition))
    })

    return [ ...requiredTypeNames ].flatMap(typeName => {
        const definition = definitions.get(typeName)
        /* v8 ignore next -- @preserve recursive references normally come from collected object definitions */
        if (!definition) return []

        const preparedDefinition = buildVariableValue(definition, state, customScalars)
        /* v8 ignore next -- @preserve collected definitions are object values */
        if (preparedDefinition.kind !== VALUE_MODEL_KIND.OBJECT) return []

        return [{
            typeName,
            aliasName: getAllocatedVariableAliasName(typeName, state),
            fields: preparedDefinition.fields,
        }]
    })
}
