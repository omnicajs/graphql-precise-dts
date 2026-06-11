import type { DocumentFile } from '../plugin-types'
import type { FragmentDefinitionNode } from 'graphql'

import {
    collectFragmentSpreads,
    formatNodeLocation,
    makeDocumentLocationMap,
} from '../lib/documents'

import { Kind } from 'graphql'

const UNKNOWN_DOCUMENT_LOCATION = '<unknown document>'

export const emitDuplicateFragmentDefinitionWarnings = (documents: DocumentFile[]) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const fragments = new Map<string, FragmentDefinitionNode>()

        documentFile.document.definitions.forEach(definition => {
            if (definition.kind !== Kind.FRAGMENT_DEFINITION) return

            const existingDefinition = fragments.get(definition.name.value)
            if (!existingDefinition) {
                fragments.set(definition.name.value, definition)
                return
            }

            const duplicateLocation = formatNodeLocation(definition, documentLocations)
                ?? documentFile.location
                ?? UNKNOWN_DOCUMENT_LOCATION
            const firstLocation = formatNodeLocation(existingDefinition, documentLocations)
                ?? documentFile.location
                ?? UNKNOWN_DOCUMENT_LOCATION

            const duplicateType = definition.typeCondition.name.value
            const firstType = existingDefinition.typeCondition.name.value

            const typeDetails = duplicateType === firstType
                ? `Both definitions target type "${firstType}".`
                : `The first definition targets type "${firstType}", while the duplicate targets type "${duplicateType}".`

            console.warn(
                `Duplicate fragment definition "${definition.name.value}" detected in "${duplicateLocation}". `
                + `${typeDetails} The plugin keeps the first definition from "${firstLocation}" and ignores this duplicate.`
            )
        })
    })
}

export const emitMissingFragmentDefinitionWarnings = (
    documents: DocumentFile[],
    fragmentDefinitions: Map<string, FragmentDefinitionNode>
) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const missingFragmentSpreads = collectFragmentSpreads(documentFile.document)
            .filter(fragmentSpread => !fragmentDefinitions.has(fragmentSpread.name.value))

        if (!missingFragmentSpreads.length) return

        missingFragmentSpreads.forEach(fragmentSpread => {
            const documentLocation = formatNodeLocation(fragmentSpread, documentLocations)
                ?? documentFile.location
                ?? UNKNOWN_DOCUMENT_LOCATION

            console.warn(
                `Fragment definition "${fragmentSpread.name.value}" referenced from "${documentLocation}" was not found among the documents configured for the plugin.`
            )
        })
    })
}
