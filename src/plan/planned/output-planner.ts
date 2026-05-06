import type { CustomScalarMappings } from '../../scalars/types'
import type { GenerationDirectivePolicies } from '../../directives/types'
import type { NormalizedSelectionModel } from './normalize/selection'
import type { WarningReporter } from '../warnings'

import type {
    FieldValue,
    FragmentModel,
    FragmentRoot,
} from '../../models/types'

import type {
    ObjectRenderOptions,
    OutputBuildState,
    OutputObjectOccurrence,
    PlannedFieldValue,
    PlannedFragmentModel,
    PlannedFragmentRoot,
    PlannedObjectFieldValue,
    PlannedOutputAlias,
    PlannedSelectionModel,
} from './types'

import { resolveGenerationSelectionDirectives } from '../../directives/resolve'
import { capitalize } from '../../lib/strings'
import { normalizeTsType } from '../../ts-type'
import { makeOutputShapeSignature } from './normalize/shape-signature'
import { normalizeSelections } from './normalize/selection'
import {
    buildScalarValue,
    getSuggestedOutputAliasName,
} from './shared'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../kinds'

const makeObjectRenderOptions = (typeNames?: string[]): ObjectRenderOptions => ({
    dedupeTypenameWithSpread: true,
    dedupeTypenameWithAlias: (typeNames?.length ?? 0) === 1,
})

export const createOutputBuildState = (): OutputBuildState => ({
    occurrences: new Map(),
    inProgressSignatures: new Set(),
    inProgressObjectNodes: new WeakMap(),
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
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: WarningReporter
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
        buildSelection(selection, aliasName, state, customScalars, directivePolicies, reportWarning)
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
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: WarningReporter
): PlannedFieldValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return buildScalarValue(value, customScalars)
        case VALUE_MODEL_KIND.OBJECT:
            return buildObjectFieldValue(value, aliasName, state, customScalars, directivePolicies, reportWarning)
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
                            directivePolicies,
                            reportWarning
                        )
                    ),
                })),
            }
        default:
            return value
    }
}

export const buildSelection = (
    selection: NormalizedSelectionModel,
    parentAliasName: string,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: WarningReporter
): PlannedSelectionModel => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD: {
            const generationDirectives = resolveGenerationSelectionDirectives(
                selection.directiveNames ?? [],
                SELECTION_MODEL_KIND.FIELD,
                directivePolicies
            )

            generationDirectives.warnings.forEach(reportWarning)

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
                    directivePolicies,
                    reportWarning
                ),
            }
        }
        default: {
            const generationDirectives = resolveGenerationSelectionDirectives(
                selection.directiveNames ?? [],
                SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
                directivePolicies
            )

            generationDirectives.warnings.forEach(reportWarning)
            return selection
        }
    }
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

export const buildOutputAliases = (
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
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: WarningReporter
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
                    directivePolicies,
                    reportWarning
                )
            ),
        })),
    }
    : {
        kind: FRAGMENT_ROOT_KIND.OBJECT,
        fields: normalizeSelections(root.fields).map(selection =>
            buildSelection(selection, fragmentName, state, customScalars, directivePolicies, reportWarning)
        ),
    }

export const buildFragmentModel = (
    fragmentName: string,
    fragment: FragmentModel,
    state: OutputBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: WarningReporter
): PlannedFragmentModel => ({
    ...fragment,
    root: buildFragmentRoot(fragmentName, fragment.root, state, customScalars, directivePolicies, reportWarning),
})
