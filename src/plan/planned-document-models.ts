import type { CollectedDocumentModels } from '../models/types'
import type { CustomScalarMappings } from '../scalars/types'
import type { ConfigDirectivePolicies } from '../directives/types'
import type {
    FieldValue,
    FragmentModel,
    FragmentRoot,
} from '../models/types'
import type { NormalizedSelectionModel } from './selection-normalization'
import type { ObjectRenderOptions } from './planned-types'
import type { OperationModel } from '../models/types'
import type {
    OutputBuildState,
    OutputObjectOccurrence,
    PlannedDocumentModels,
    PlannedFieldValue,
    PlannedFragmentModel,
    PlannedFragmentRoot,
    PlannedObjectFieldValue,
    PlannedOperationModel,
    PlannedOutputAlias,
    PlannedSelectionModel,
    PlannedVariableAlias,
    PlannedVariableField,
    PlannedVariableObjectValue,
    PlannedVariableValue,
} from './planned-types'
import type {
    VariableField,
    VariableValue,
} from '../models/types'

import { capitalize } from '../lib/strings'
import { getOperationTypeName } from './naming'
import { getScalarTsType } from '../scalars/builder'
import { getVariableObjectAliasName } from './naming'
import { makeOutputShapeSignature } from './output-shape-signature'
import { normalizeSelections } from './selection-normalization'
import { normalizeTsType } from '../ts-type'
import { resolveGenerationSelectionDirectives } from '../directives/resolve'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../kinds'

type VariableBuildState = {
    cache: Map<string, PlannedVariableObjectValue>;
    inProgress: Set<string>;
}

const getSuggestedOutputAliasName = (
    parentAliasName: string,
    responseName: string,
    value: FieldValue
): string => {
    if (value.kind === VALUE_MODEL_KIND.OBJECT && value.typeNames?.length === 1) {
        return `${parentAliasName}${capitalize(value.typeNames[0])}`
    }

    return `${parentAliasName}${capitalize(responseName)}`
}

const makeObjectRenderOptions = (typeNames?: string[]): ObjectRenderOptions => ({
    dedupeTypenameWithSpread: true,
    dedupeTypenameWithAlias: (typeNames?.length ?? 0) === 1,
})

const buildScalarValue = (
    value: Extract<FieldValue | VariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }>,
    customScalars: CustomScalarMappings
): Extract<PlannedFieldValue | PlannedVariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    typeTs: getScalarTsType(value.name, customScalars, value.usage),
})

const buildVariableValue = (
    value: VariableValue,
    state: VariableBuildState,
    customScalars: CustomScalarMappings
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
            renderAliasName: getVariableObjectAliasName(value.typeName),
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
                renderAliasName: getVariableObjectAliasName(value.typeName),
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

const buildVariableField = (
    field: VariableField,
    state: VariableBuildState,
    customScalars: CustomScalarMappings
): PlannedVariableField => ({
    ...field,
    value: buildVariableValue(field.value, state, customScalars),
})

const registerOutputObjectOccurrence = (
    signature: string,
    suggestedAliasName: string,
    node: PlannedObjectFieldValue,
    state: OutputBuildState
): OutputObjectOccurrence => {
    const occurrence = state.occurrences.get(signature)
    if (occurrence) {
        occurrence.count++
        occurrence.nodes.push(node)
        return occurrence
    }

    const nextOccurrence: OutputObjectOccurrence = {
        count: 1,
        recursive: false,
        suggestedAliasName,
        nodes: [node],
    }

    state.occurrences.set(signature, nextOccurrence)
    return nextOccurrence
}

const buildObjectFieldValue = (
    value: FieldValue,
    aliasName: string,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): PlannedObjectFieldValue => {
    if (value.kind !== VALUE_MODEL_KIND.OBJECT) {
        throw new Error('Expected object field value')
    }

    const renderOptions = makeObjectRenderOptions(value.typeNames)
    const signature = makeOutputShapeSignature(value.fields, value.typeNames ?? [], renderOptions)

    const existingNode = state.inProgressObjectNodes.get(value)
    if (existingNode) {
        const recursiveOccurrence = registerOutputObjectOccurrence(signature, aliasName, existingNode, state)
        recursiveOccurrence.recursive = true

        return existingNode
    }

    const node: PlannedObjectFieldValue = {
        kind: VALUE_MODEL_KIND.OBJECT,
        fields: [],
        typeNames: value.typeNames,
        renderOptions,
    }

    const occurrence = registerOutputObjectOccurrence(signature, aliasName, node, state)
    const alreadyInProgress = state.inProgressSignatures.has(signature)

    if (alreadyInProgress) occurrence.recursive = true

    state.inProgressObjectNodes.set(value, node)
    if (!alreadyInProgress) state.inProgressSignatures.add(signature)

    node.fields = normalizeSelections(value.fields).map(selection =>
        buildSelection(selection, aliasName, state, customScalars, directivePolicies)
    )

    if (!alreadyInProgress) state.inProgressSignatures.delete(signature)
    state.inProgressObjectNodes.delete(value)

    return node
}

const buildFieldValue = (
    value: FieldValue,
    aliasName: string,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): PlannedFieldValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return buildScalarValue(value, customScalars)
        case VALUE_MODEL_KIND.OBJECT:
            return buildObjectFieldValue(value, aliasName, state, customScalars, directivePolicies)
        case VALUE_MODEL_KIND.UNION:
            return {
                kind: VALUE_MODEL_KIND.UNION,
                variants: value.variants.map(variant => ({
                    typeName: variant.typeName,
                    fields: normalizeSelections(variant.fields).map(selection =>
                        buildSelection(
                            selection,
                            `${aliasName}${capitalize(variant.typeName)}`,
                            state,
                            customScalars,
                            directivePolicies
                        )
                    ),
                })),
            }
        default:
            return value
    }
}

const buildSelection = (
    selection: NormalizedSelectionModel,
    parentAliasName: string,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): PlannedSelectionModel => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD: {
            const generationDirectives = resolveGenerationSelectionDirectives(
                selection.directiveNames ?? [],
                SELECTION_MODEL_KIND.FIELD,
                directivePolicies
            )

            generationDirectives.warnings.forEach(message => console.warn(message))

            return {
                ...selection,
                ...(generationDirectives.overrideType
                    ? { overrideTypeTs: normalizeTsType(generationDirectives.overrideType) }
                    : {}),
                value: buildFieldValue(
                    selection.value,
                    getSuggestedOutputAliasName(parentAliasName, selection.responseName, selection.value),
                    state,
                    customScalars,
                    directivePolicies
                ),
            }
        }
        default: {
            const generationDirectives = resolveGenerationSelectionDirectives(
                selection.directiveNames ?? [],
                SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                directivePolicies
            )

            generationDirectives.warnings.forEach(message => console.warn(message))
            return selection
        }
    }
}

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

const buildVariableAliases = (
    operations: Map<string, OperationModel>,
    state: VariableBuildState,
    customScalars: CustomScalarMappings
): PlannedVariableAlias[] => {
    const { requiredTypeNames, definitions } = collectVariableDefinitions(operations)

    return [ ...requiredTypeNames ].flatMap(typeName => {
        const definition = definitions.get(typeName)
        const preparedDefinition = definition ? buildVariableValue(definition, state, customScalars) : undefined

        return preparedDefinition && preparedDefinition.kind === VALUE_MODEL_KIND.OBJECT
            ? [{
                typeName,
                aliasName: getVariableObjectAliasName(typeName),
                fields: preparedDefinition.fields,
            }]
            : []
    })
}

const makeUniqueAliasName = (baseName: string, reservedNames: Set<string>): string => {
    let aliasName = baseName
    let index = 2

    while (reservedNames.has(aliasName)) {
        aliasName = `${baseName}${index}`
        index++
    }

    reservedNames.add(aliasName)
    return aliasName
}

const buildOutputAliases = (
    occurrences: Map<string, OutputObjectOccurrence>,
    reservedNames: Set<string>
): PlannedOutputAlias[] => {
    const outputAliases: PlannedOutputAlias[] = []

    occurrences.forEach(occurrence => {
        if (!occurrence.recursive && occurrence.count < 2) return

        const aliasName = makeUniqueAliasName(occurrence.suggestedAliasName, reservedNames)
        const representativeNode = occurrence.nodes[0]
        if (!representativeNode) return

        occurrence.nodes.forEach(node => {
            node.renderAliasName = aliasName
            node.renderAsReference = true
        })

        outputAliases.push({
            aliasName,
            typeNames: representativeNode.typeNames ?? [],
            fields: representativeNode.fields,
            renderOptions: representativeNode.renderOptions,
        })
    })

    return outputAliases
}

const buildFragmentRoot = (
    fragmentName: string,
    root: FragmentRoot,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): PlannedFragmentRoot => root.kind === FRAGMENT_ROOT_KIND.UNION
    ? {
        kind: FRAGMENT_ROOT_KIND.UNION,
        variants: root.variants.map(variant => ({
            typeName: variant.typeName,
            fields: normalizeSelections(variant.fields).map(selection =>
                buildSelection(
                    selection,
                    `${fragmentName}${capitalize(variant.typeName)}`,
                    state,
                    customScalars,
                    directivePolicies
                )
            ),
        })),
    }
    : {
        kind: FRAGMENT_ROOT_KIND.OBJECT,
        fields: normalizeSelections(root.fields).map(selection =>
            buildSelection(selection, fragmentName, state, customScalars, directivePolicies)
        ),
    }

const buildFragmentModel = (
    fragmentName: string,
    fragment: FragmentModel,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): PlannedFragmentModel => ({
    ...fragment,
    root: buildFragmentRoot(fragmentName, fragment.root, state, customScalars, directivePolicies),
})

const buildOperationModel = (
    operationName: string,
    operation: OperationModel,
    outputState: OutputBuildState,
    variableState: VariableBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: ConfigDirectivePolicies
): PlannedOperationModel => {
    const operationTypeName = getOperationTypeName(operationName, operation.operationType)

    return {
        ...operation,
        variables: operation.variables.map(variable =>
            buildVariableField(variable, variableState, customScalars)
        ),
        result: normalizeSelections(operation.result).map(selection =>
            buildSelection(selection, operationTypeName, outputState, customScalars, directivePolicies)
        ),
    }
}

export const makePlannedDocumentModels = (
    models: CollectedDocumentModels,
    reservedNames: string[] = [],
    customScalars: CustomScalarMappings = {},
    directivePolicies: ConfigDirectivePolicies = {}
): PlannedDocumentModels => {
    const outputBuildState: OutputBuildState = {
        occurrences: new Map(),
        inProgressSignatures: new Set(),
        inProgressObjectNodes: new WeakMap(),
    }
    const variableBuildState: VariableBuildState = {
        cache: new Map(),
        inProgress: new Set(),
    }

    const reservedAliasNames = new Set([
        ...reservedNames,
        ...models.fragments.keys(),
        ...[ ...models.operations.entries() ]
            .map(([ key, operation ]) => getOperationTypeName(key, operation.operationType)),
    ])

    return {
        fragments: new Map(
            [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
                name,
                buildFragmentModel(name, fragment, outputBuildState, customScalars, directivePolicies),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                buildOperationModel(
                    name,
                    operation,
                    outputBuildState,
                    variableBuildState,
                    customScalars,
                    directivePolicies
                ),
            ])
        ),
        variableAliases: buildVariableAliases(models.operations, variableBuildState, customScalars),
        outputAliases: buildOutputAliases(outputBuildState.occurrences, reservedAliasNames),
    }
}
