import type { DocumentFile } from '../plugin-types'
import type {
    OperationDefinitionNode,
    Source,
} from 'graphql'

import {
    formatNodeLocation,
    makeDocumentLocationMap,
} from './documents'
import { visit } from 'graphql'

const UNKNOWN_DOCUMENT_LOCATION = '<unknown document>'

const getDocumentLocation = (
    node: OperationDefinitionNode,
    documentLocations: WeakMap<Source, string>,
    fallbackLocation: string | undefined
): string => formatNodeLocation(node, documentLocations)
    ?? fallbackLocation
    ?? UNKNOWN_DOCUMENT_LOCATION

export const assertNamedOperation = (
    node: OperationDefinitionNode,
    documentLocations: WeakMap<Source, string>,
    location?: string
): string => {
    if (node.name?.value) return node.name.value

    throw new Error(
        `Operation name is missing for ${node.operation} operation in "${getDocumentLocation(node, documentLocations, location)}". `
        + 'Name the operation so the plugin can generate stable declaration exports.'
    )
}

export const validateNamedOperations = (documents: DocumentFile[]) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        visit(documentFile.document, {
            OperationDefinition(node) {
                assertNamedOperation(node, documentLocations, documentFile.location)
            },
        })
    })
}
