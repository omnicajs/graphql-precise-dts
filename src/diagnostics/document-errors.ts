import type { DocumentFile } from '../plugin-types'
import type { OperationDefinitionNode } from 'graphql'
import type { Schema } from '../plugin-types'
import type {
    DocumentNode,
    Source,
    VariableDefinitionNode,
} from 'graphql'

import { TypeInfo } from 'graphql'

import { formatNodeLocation } from '../lib/documents'
import { getRootTypeForOperation } from '../lib/operations'
import { makeDocumentLocationMap } from '../lib/documents'
import {
    isRequiredArgument,
    visit,
    visitWithTypeInfo,
} from 'graphql'

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
    operationName: string,
    schema: Schema,
    documentLocations: WeakMap<Source, string>,
    location?: string
) => {
    if (getRootTypeForOperation(node.operation, schema)) return

    throw new Error(
        `Root type for ${node.operation} operation "${operationName}" was not found in schema at "${getDocumentLocation(node, documentLocations, location)}". `
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

const assertKnownTypeConditions = (
    document: DocumentNode,
    schema: Schema,
    documentLocations: WeakMap<Source, string>,
    location?: string
) => {
    visit(document, {
        FragmentDefinition(node) {
            const typeName = node.typeCondition.name.value
            if (schema.getType(typeName)) return

            throw new Error(
                `Unknown fragment type "${typeName}" detected at "${formatNodeLocation(node.typeCondition, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                + 'Fragment type conditions must reference types from the GraphQL schema.'
            )
        },
        InlineFragment({ typeCondition }) {
            if (!typeCondition) return

            const typeName = typeCondition.name.value
            if (schema.getType(typeName)) return

            throw new Error(
                `Unknown inline fragment type "${typeName}" detected at "${formatNodeLocation(typeCondition, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                + 'Inline fragment type conditions must reference types from the GraphQL schema.'
            )
        },
    })
}

const assertKnownFieldArguments = (
    document: DocumentNode,
    schema: Schema,
    documentLocations: WeakMap<Source, string>,
    location?: string
) => {
    const typeInfo = new TypeInfo(schema)

    visit(document, visitWithTypeInfo(typeInfo, {
        Field(node) {
            const fieldDef = typeInfo.getFieldDef()
            const parentType = typeInfo.getParentType()
            /* v8 ignore next -- @preserve TypeInfo resolves parent types for valid field selections. */
            if (!parentType) return

            if (!fieldDef) {
                throw new Error(
                    `Unknown field "${node.name.value}" detected on type "${parentType.name}" at "${formatNodeLocation(node, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                    + 'Field selections must match the GraphQL schema.'
                )
            }

            const fieldLabel = `${parentType.name}.${node.name.value}`

            let providedArguments = node.arguments
            /* v8 ignore next -- @preserve graphql-js parse returns an empty array for fields without arguments. */
            if (!providedArguments) providedArguments = []

            const fieldArgumentIndexes = new Map(fieldDef.args.map((argument, index) => [ argument.name, index ]))
            const providedArgumentNames = new Set(providedArguments.map(argument => argument.name.value))

            const missingRequiredArgument = fieldDef.args.find(argument =>
                isRequiredArgument(argument) && !providedArgumentNames.has(argument.name)
            )
            if (missingRequiredArgument) {
                throw new Error(
                    `Required argument "${missingRequiredArgument.name}" is missing on field "${fieldLabel}" at "${formatNodeLocation(node, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                    + 'Required field arguments must be provided.'
                )
            }

            const unknownArgument = providedArguments.find(argument => !fieldArgumentIndexes.has(argument.name.value))
            if (unknownArgument) {
                throw new Error(
                    `Unknown argument "${unknownArgument.name.value}" detected on field "${fieldLabel}" at "${formatNodeLocation(unknownArgument, documentLocations) ?? location ?? UNKNOWN_DOCUMENT_LOCATION}". `
                    + 'Field arguments must match the GraphQL schema.'
                )
            }
        },
    }))
}

export const guardNamedOperations = (
    documents: DocumentFile[],
    schema: Schema
) => {
    const documentLocations = makeDocumentLocationMap(documents)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        assertKnownTypeConditions(documentFile.document, schema, documentLocations, documentFile.location)
        assertKnownFieldArguments(documentFile.document, schema, documentLocations, documentFile.location)

        const operations = new Map<string, OperationDefinitionNode>()

        visit(documentFile.document, {
            OperationDefinition(node) {
                const operationName = assertNamedOperation(node, documentLocations, documentFile.location)
                assertOperationRootType(node, operationName, schema, documentLocations, documentFile.location)
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
