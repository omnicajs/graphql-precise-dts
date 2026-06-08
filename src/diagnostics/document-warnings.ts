import type { DocumentFile } from '../plugin-types'
import type { FragmentDefinitionNode } from 'graphql'

import {
    collectFragmentSpreads,
    formatNodeLocation,
    makeDocumentLocationMap,
} from '../lib/documents'

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
                ?? '<unknown document>'

            console.warn(
                `Fragment definition "${fragmentSpread.name.value}" referenced from "${documentLocation}" was not found among the documents configured for the plugin.`
            )
        })
    })
}
