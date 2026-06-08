import type { DocumentFile } from '../plugin-types'

import type {
    DefinitionNode,
    SelectionNode,
    SelectionSetNode,
    Source,
} from 'graphql'

import {
    formatNodeLocation,
    makeDocumentLocationMap,
} from '../lib/documents'

import { Kind } from 'graphql'

const getSelectionSetLabel = (definition: DefinitionNode): string => {
    switch (definition.kind) {
        case Kind.FRAGMENT_DEFINITION:
            return `fragment "${definition.name.value}"`
        case Kind.OPERATION_DEFINITION:
            return `${definition.operation} "${definition.name?.value ?? 'unknown'}"`
        default:
            return 'selection set'
    }
}

const emitRepeatedSelectionWarningsForSet = (
    selectionSet: SelectionSetNode,
    documentLocations: WeakMap<Source, string>,
    selectionSetLabel: string
) => {
    const fieldLocations = new Map<string, string>()
    const spreadLocations = new Map<string, string>()

    selectionSet.selections.forEach(selection => {
        if (selection.kind === Kind.FIELD) {
            const responseName = selection.alias?.value ?? selection.name.value
            const selectionLocation = formatNodeLocation(selection, documentLocations)

            if (fieldLocations.has(responseName)) {
                console.warn(
                    `Repeated field selection "${responseName}" detected in ${selectionSetLabel} at "${selectionLocation ?? '<unknown location>'}". `
                    + `The plugin merged it, but the selection is redundant. First occurrence: "${fieldLocations.get(responseName) ?? '<unknown location>'}".`
                )
            } else if (selectionLocation) {
                fieldLocations.set(responseName, selectionLocation)
            }
        }

        if (selection.kind === Kind.FRAGMENT_SPREAD) {
            const selectionLocation = formatNodeLocation(selection, documentLocations)

            if (spreadLocations.has(selection.name.value)) {
                console.warn(
                    `Repeated fragment spread "${selection.name.value}" detected in ${selectionSetLabel} at "${selectionLocation ?? '<unknown location>'}". `
                    + `The plugin merged it, but the spread is redundant. First occurrence: "${spreadLocations.get(selection.name.value) ?? '<unknown location>'}".`
                )
            } else if (selectionLocation) {
                spreadLocations.set(selection.name.value, selectionLocation)
            }
        }
    })
}

const getNestedSelectionSet = (selection: SelectionNode): SelectionSetNode | undefined => {
    switch (selection.kind) {
        case Kind.FIELD:
        case Kind.INLINE_FRAGMENT:
            return selection.selectionSet
        default:
            return undefined
    }
}

const emitRepeatedSelectionWarningsForNode = (
    selection: SelectionNode,
    documentLocations: WeakMap<Source, string>,
    selectionSetLabel: string
) => {
    const nestedSelectionSet = getNestedSelectionSet(selection)
    if (!nestedSelectionSet) return

    emitRepeatedSelectionWarningsForSet(nestedSelectionSet, documentLocations, selectionSetLabel)

    nestedSelectionSet.selections.forEach(childSelection =>
        emitRepeatedSelectionWarningsForNode(childSelection, documentLocations, selectionSetLabel)
    )
}

export const emitRepeatedSelectionWarnings = (
    documents: DocumentFile[]
) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        const document = documentFile.document
        if (!document) return

        document.definitions.forEach(definition => {
            if (
                definition.kind !== Kind.FRAGMENT_DEFINITION
                && definition.kind !== Kind.OPERATION_DEFINITION
            ) return

            const selectionSetLabel = getSelectionSetLabel(definition)
            emitRepeatedSelectionWarningsForSet(definition.selectionSet, documentLocations, selectionSetLabel)
            definition.selectionSet.selections.forEach(selection =>
                emitRepeatedSelectionWarningsForNode(selection, documentLocations, selectionSetLabel)
            )
        })
    })
}
