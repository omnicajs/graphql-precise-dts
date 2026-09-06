import type {
    PlannedDefinition,
    PlannedDocument,
    PlannedFragment,
    PlannedOperation,
} from './plan/types'
import type { SchemaInput } from './types'
import { posix } from 'node:path'
import type { NamingConvention } from './naming'

import { createNamingConvention } from './naming'
import {
    indent,
    uncapitalize,
} from '@/strings'
import { renderImports } from './render/imports'
import { renderComposite } from './render/selections'
import { renderVariables } from './render/inputs'
import { escapeModuleSpecifier } from './render/syntax'

const renderFragment = (
    fragment: PlannedFragment,
    naming: NamingConvention,
    schema: SchemaInput
): string => `export type ${naming.fragmentName(fragment.name)} = ${renderComposite(
    fragment.selectionSet,
    naming,
    schema
)}`

const renderOperation = (
    operation: PlannedOperation,
    naming: NamingConvention,
    defaultExport: boolean,
    schema: SchemaInput
): ReadonlyArray<string> => {
    const operationTypeName = naming.operationTypeName(operation.name, operation.operation)
    const variablesTypeName = naming.operationVariablesTypeName(operation.name, operation.operation)
    const payloadTypeName = naming.operationPayloadTypeName(operation.name, operation.operation)
    const exportName = uncapitalize(operationTypeName)

    return [
        `export type ${variablesTypeName} = ${operation.variables.length
            ? `Exact<${renderVariables(operation.variables, naming)}>`
            : '{ [key: string]: never }'}`,
        `export type ${payloadTypeName} = ${renderComposite(operation.selectionSet, naming, schema)}`,
        `export const ${exportName}: TypedDocumentNode<${payloadTypeName}, ${variablesTypeName}>`,
        ...(defaultExport ? [ `export default ${exportName}` ] : []),
    ]
}

const renderDefinition = (
    definition: PlannedDefinition,
    naming: NamingConvention,
    defaultExport: boolean,
    schema: SchemaInput
): ReadonlyArray<string> => definition.kind === 'fragment'
    ? [ renderFragment(definition, naming, schema) ]
    : renderOperation(definition, naming, defaultExport, schema)

export const renderDocument = (
    document: PlannedDocument,
    schema: SchemaInput,
    modulePaths?: Readonly<Record<string, string>>
): string => {
    const naming = createNamingConvention(schema.naming)
    const operations = document.definitions.filter(
        (definition): definition is PlannedOperation => definition.kind === 'operation'
    )
    const blocks = [
        ...renderImports(document.imports.map(plannedImport => {
            if (!modulePaths || !Object.prototype.hasOwnProperty.call(modulePaths, plannedImport.source)) return plannedImport
            const relative = posix.relative(posix.dirname(modulePaths[document.sourceId]), modulePaths[plannedImport.source])
            return { ...plannedImport, source: relative.startsWith('.') ? relative : `./${relative}` }
        })),
        ...document.definitions.flatMap(definition => renderDefinition(
            definition,
            naming,
            operations.length === 1 && (!!modulePaths || document.definitions.length === 1) && definition === operations[0],
            schema
        )),
    ]

    if (modulePaths) {
        if (operations.length !== 1) {
            const names = new Set([
                ...document.imports.flatMap(plannedImport => plannedImport.names),
                ...document.definitions.filter(definition => definition.kind === 'fragment')
                    .map(fragment => naming.fragmentName(fragment.name)),
            ])
            let name = 'document'
            while (names.has(name)) name = `_${name}`
            blocks.push(`declare const ${name}: import('graphql').DocumentNode`, `export default ${name}`)
        }
        return `${blocks.join('\n\n')}\n`
    }

    return [
        `declare module '${escapeModuleSpecifier(document.sourceId)}' {`,
        blocks.map(block => indent(block)).join('\n\n'),
        '}',
        '',
    ].join('\n')
}
