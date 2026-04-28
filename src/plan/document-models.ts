import type { CollectedDocumentModels } from '../models/types'
import type {
    DocumentFieldValue,
    DocumentFragmentModel,
    DocumentFragmentRoot,
    DocumentInputAlias,
    DocumentInputField,
    DocumentInputObjectValue,
    DocumentInputValue,
    DocumentModels,
    DocumentObjectFieldValue,
    DocumentOperationModel,
    DocumentOutputAlias,
    DocumentSelectionModel,
} from './document-models-types'
import type {
    FieldValue,
    FragmentModel,
    FragmentRoot,
    InputField,
    InputValue,
} from '../models/types'
import type { ObjectRenderOptions } from './document-models-types'
import type { OperationModel } from '../models/types'
import type {
    OutputBuildState,
    OutputObjectOccurrence,
} from './document-models-types'
import type {
    SelectionModel,
} from '../models/types'

import { capitalize } from '../lib/strings'
import { getOperationTypeName } from '../lib/operation-name'
import { makeOutputShapeSignature } from './output-shape-signature'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../models/kinds'

type InputBuildState = {
    cache: Map<string, DocumentInputObjectValue>;
    inProgress: Set<string>;
}

export const getInputObjectAliasName = (typeName: string): string => {
    return typeName.endsWith('Input') ? typeName : `${typeName}Input`
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

const buildInputValue = (
    value: InputValue,
    state: InputBuildState
): DocumentInputValue => {
    if (value.kind !== VALUE_MODEL_KIND.OBJECT) return value

    if (value.typeName && value.isRecursiveReference) {
        return {
            kind: VALUE_MODEL_KIND.OBJECT,
            typeName: value.typeName,
            fields: [],
            renderAliasName: getInputObjectAliasName(value.typeName),
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
                renderAliasName: getInputObjectAliasName(value.typeName),
                renderAsReference: true,
            }
        }
    }

    const node: DocumentInputObjectValue = {
        kind: VALUE_MODEL_KIND.OBJECT,
        typeName: value.typeName,
        fields: [],
    }

    if (value.typeName) {
        state.inProgress.add(value.typeName)
        state.cache.set(value.typeName, node)
    }

    node.fields = value.fields.map(field => buildInputField(field, state))

    if (value.typeName) {
        state.inProgress.delete(value.typeName)
    }

    return node
}

const buildInputField = (
    field: InputField,
    state: InputBuildState
): DocumentInputField => ({
    ...field,
    value: buildInputValue(field.value, state),
})

const registerOutputObjectOccurrence = (
    signature: string,
    suggestedAliasName: string,
    node: DocumentObjectFieldValue,
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
    state: OutputBuildState
): DocumentObjectFieldValue => {
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

    const node: DocumentObjectFieldValue = {
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

    node.fields = value.fields.map(selection => buildSelection(selection, aliasName, state))

    if (!alreadyInProgress) state.inProgressSignatures.delete(signature)
    state.inProgressObjectNodes.delete(value)

    return node
}

const buildFieldValue = (
    value: FieldValue,
    aliasName: string,
    state: OutputBuildState
): DocumentFieldValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.OBJECT:
            return buildObjectFieldValue(value, aliasName, state)
        case VALUE_MODEL_KIND.UNION:
            return {
                kind: VALUE_MODEL_KIND.UNION,
                variants: value.variants.map(variant => ({
                    typeName: variant.typeName,
                    fields: variant.fields.map(selection =>
                        buildSelection(
                            selection,
                            `${aliasName}${capitalize(variant.typeName)}`,
                            state
                        )
                    ),
                })),
            }
        default:
            return value
    }
}

const buildSelection = (
    selection: SelectionModel,
    parentAliasName: string,
    state: OutputBuildState
): DocumentSelectionModel => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD:
            return {
                ...selection,
                value: buildFieldValue(
                    selection.value,
                    getSuggestedOutputAliasName(parentAliasName, selection.responseName, selection.value),
                    state
                ),
            }
        case SELECTION_MODEL_KIND.INLINE_FRAGMENT:
            return {
                ...selection,
                selections: selection.selections.map(nested =>
                    buildSelection(nested, parentAliasName, state)
                ),
            }
        default:
            return selection
    }
}

const collectInputDefinitionsFromValue = (
    value: InputValue,
    requiredTypeNames: Set<string>,
    definitions: Map<string, Extract<InputValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>
) => {
    if (value.kind !== VALUE_MODEL_KIND.OBJECT) return

    if (value.typeName) {
        if (value.isRecursiveReference) {
            requiredTypeNames.add(value.typeName)
            return
        }

        definitions.set(value.typeName, value)
    }

    value.fields.forEach(field => collectInputDefinitionsFromValue(field.value, requiredTypeNames, definitions))
}

const collectInputDefinitions = (operations: Map<string, OperationModel>) => {
    const requiredTypeNames = new Set<string>()
    const definitions = new Map<string, Extract<InputValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>>()

    operations.forEach(operation => {
        operation.variables.forEach(variable => collectInputDefinitionsFromValue(variable.value, requiredTypeNames, definitions))
    })

    return { requiredTypeNames, definitions }
}

const buildInputAliases = (
    operations: Map<string, OperationModel>,
    state: InputBuildState
): DocumentInputAlias[] => {
    const { requiredTypeNames, definitions } = collectInputDefinitions(operations)

    return [ ...requiredTypeNames ].flatMap(typeName => {
        const definition = definitions.get(typeName)
        const preparedDefinition = definition ? buildInputValue(definition, state) : undefined

        return preparedDefinition && preparedDefinition.kind === VALUE_MODEL_KIND.OBJECT
            ? [{
                typeName,
                aliasName: getInputObjectAliasName(typeName),
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
): DocumentOutputAlias[] => {
    const outputAliases: DocumentOutputAlias[] = []

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
    state: OutputBuildState
): DocumentFragmentRoot => root.kind === FRAGMENT_ROOT_KIND.UNION
    ? {
        kind: FRAGMENT_ROOT_KIND.UNION,
        variants: root.variants.map(variant => ({
            typeName: variant.typeName,
            fields: variant.fields.map(selection =>
                buildSelection(
                    selection,
                    `${fragmentName}${capitalize(variant.typeName)}`,
                    state
                )
            ),
        })),
    }
    : {
        kind: FRAGMENT_ROOT_KIND.OBJECT,
        fields: root.fields.map(selection => buildSelection(selection, fragmentName, state)),
    }

const buildFragmentModel = (
    fragmentName: string,
    fragment: FragmentModel,
    state: OutputBuildState
): DocumentFragmentModel => ({
    ...fragment,
    root: buildFragmentRoot(fragmentName, fragment.root, state),
})

const buildOperationModel = (
    operationName: string,
    operation: OperationModel,
    outputState: OutputBuildState,
    inputState: InputBuildState
): DocumentOperationModel => {
    const operationTypeName = getOperationTypeName(operationName, operation.operationType)

    return {
        ...operation,
        variables: operation.variables.map(variable => buildInputField(variable, inputState)),
        result: operation.result.map(selection => buildSelection(selection, operationTypeName, outputState)),
    }
}

export const buildDocumentModels = (
    models: CollectedDocumentModels,
    reservedNames: string[] = []
): DocumentModels => {
    const outputBuildState: OutputBuildState = {
        occurrences: new Map(),
        inProgressSignatures: new Set(),
        inProgressObjectNodes: new WeakMap(),
    }
    const inputBuildState: InputBuildState = {
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
                buildFragmentModel(name, fragment, outputBuildState),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                buildOperationModel(name, operation, outputBuildState, inputBuildState),
            ])
        ),
        inputAliases: buildInputAliases(models.operations, inputBuildState),
        outputAliases: buildOutputAliases(outputBuildState.occurrences, reservedAliasNames),
    }
}
