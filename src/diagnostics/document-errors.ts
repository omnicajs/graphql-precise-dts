import type { DocumentFile } from '../plugin-types'
import type { OperationDefinitionNode } from 'graphql'
import type { Schema } from '../plugin-types'
import type {
    Source,
    VariableDefinitionNode,
} from 'graphql'

import { formatNodeLocation } from '../lib/documents'
import { getRootTypeForOperation } from '../lib/operations'
import { makeDocumentLocationMap } from '../lib/documents'
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

const assertOperationRootType = (
    node: OperationDefinitionNode,
    schema: Schema,
    documentLocations: WeakMap<Source, string>,
    location?: string
) => {
    if (getRootTypeForOperation(node.operation, schema)) return

    throw new Error(
        `Root type for ${node.operation} operation "${node.name?.value ?? '<anonymous>'}" was not found in schema at "${getDocumentLocation(node, documentLocations, location)}". `
        + `Add a ${node.operation} root type to the schema or remove the operation.`
    )
}

const assertUniqueOperationVariables = (
    node: OperationDefinitionNode,
    operationName: string,
    documentLocations: WeakMap<Source, string>,
    location?: string
) => {
    const variables = new Map<string, VariableDefinitionNode>()

    node.variableDefinitions?.forEach(variableDefinition => {
        const variableName = variableDefinition.variable.name.value
        const existingDefinition = variables.get(variableName)
        if (existingDefinition) {
            throw new Error(
                `Duplicate variable "$${variableName}" detected in operation "${operationName}" at "${formatNodeLocation(variableDefinition, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                + `The first definition is in "${formatNodeLocation(existingDefinition, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                + 'Variable names must be unique within an operation.'
            )
        }

        variables.set(variableName, variableDefinition)
    })
}

export const guardNamedOperations = (
    documents: DocumentFile[],
    schema: Schema
) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const operations = new Map<string, OperationDefinitionNode>()

        visit(documentFile.document, {
            OperationDefinition(node) {
                const operationName = assertNamedOperation(node, documentLocations, documentFile.location)
                assertOperationRootType(node, schema, documentLocations, documentFile.location)
                assertUniqueOperationVariables(node, operationName, documentLocations, documentFile.location)

                const existingOperation = operations.get(operationName)

                if (existingOperation) {
                    throw new Error(
                        `Duplicate operation name "${operationName}" detected in "${getDocumentLocation(node, documentLocations, documentFile.location)}". `
                        + `The first definition is in "${getDocumentLocation(existingOperation, documentLocations, documentFile.location)}". `
                        + 'Operation names must be unique within a document so the plugin can generate stable declaration exports.'
                    )
                }

                operations.set(operationName, node)
            },
        })
    })
}

export const emitSkippedDocumentWarnings = (documents: DocumentFile[]) => {
    documents.forEach(documentFile => {
        if (documentFile.document) return

        console.warn(
            `Document "${documentFile.location ?? UNKNOWN_DOCUMENT_LOCATION}" was skipped because no parsed GraphQL AST was provided to the plugin. `
            + 'Check the document for syntax errors or unsupported constructs; skipped documents are not included in generated declarations.'
        )
    })
}
