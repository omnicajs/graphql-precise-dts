import type { DocumentModelBundle } from '../plan/document-model-bundles'
import type {
    PlannedVariableField,
    PlannedVariableValue,
} from '../plan/planned-types'
import type {
    RenderableDocumentModels,
    RenderableFragmentModel,
    RenderableOperationModel,
    RenderableOutputAlias,
} from '../plan/renderable-document-models'
import type {
    RenderableFieldValue,
    RenderableObjectShape,
    RenderableUnionShape,
} from '../plan/renderable-types'
import type { TsType } from '../ts-type'
import type { TypeRef } from '../models/types'

import { getOperationTypeName } from '../plan/naming'
import { getVariableObjectAliasName } from '../plan/naming'
import { indent } from '../lib/strings'
import { makeNullableTsType } from '../ts-type'
import { renderStringLiteralUnion } from './basic'
import { renderTsType } from '../ts-type'
import { uncapitalize } from '../lib/strings'

import {
    FRAGMENT_ROOT_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../kinds'

type RenderableTypeValue = string | TsType

const renderFieldRow = (
    name: string,
    value: string,
    optional = false
): string => `${name}${optional ? '?' : ''}: ${value};`

const renderTypeValue = (value: RenderableTypeValue): string => typeof value === 'string'
    ? value
    : renderTsType(value)

const wrapNullable = (value: RenderableTypeValue): string => typeof value === 'string'
    ? `${value} | null`
    : renderTsType(makeNullableTsType(value))

const renderNullableTypeRef = (typeRef: TypeRef, value: RenderableTypeValue): string => {
    switch (typeRef.kind) {
        case TYPE_REF_KIND.NAMED:
            return wrapNullable(value)
        case TYPE_REF_KIND.LIST:
            return wrapNullable(`Array<${renderNullableTypeRef(typeRef.ofType, value)}>`)
        case TYPE_REF_KIND.NON_NULL:
            return renderNonNullTypeRef(typeRef.ofType, value)
    }
}

const renderNonNullTypeRef = (typeRef: TypeRef, value: RenderableTypeValue): string => {
    switch (typeRef.kind) {
        case TYPE_REF_KIND.NAMED:
            return renderTypeValue(value)
        case TYPE_REF_KIND.LIST:
            return `Array<${renderNullableTypeRef(typeRef.ofType, value)}>`
        case TYPE_REF_KIND.NON_NULL:
            return renderNonNullTypeRef(typeRef.ofType, value)
    }
}

const renderTypenameRow = (
    typeNames: string[],
    required = false
): string => renderFieldRow('__typename', renderStringLiteralUnion(typeNames), !required)

const renderObjectType = (rows: string[], spreads: string[] = []): string => [
    ...(rows.length ? [[
        '{',
        ...rows.map(row => indent(row)),
        '}',
    ].join('\n')] : []),
    ...spreads,
].join(' & ')

const renderObjectShape = ({ typename, rows, spreads }: RenderableObjectShape): string => renderObjectType([
    ...(typename ? [ renderTypenameRow(typename.typeNames, typename.required) ] : []),
    ...rows.map(field => renderFieldRow(
        field.name,
        renderNullableTypeRef(
            field.typeRef,
            field.overrideTypeTs ?? renderFieldValue(field.value)
        ),
        field.conditional
    )),
], spreads.map(spread => spread.conditional ? `Partial<${spread.name}>` : spread.name))

const renderUnionShape = (shape: RenderableUnionShape): string => {
    if (shape.kind === 'collapsed') {
        return renderObjectType([
            renderTypenameRow(shape.typename.typeNames, shape.typename.required),
            ...shape.rows.map(field => renderFieldRow(
                field.name,
                renderNullableTypeRef(
                    field.typeRef,
                    field.overrideTypeTs ?? renderFieldValue(field.value)
                ),
                field.conditional
            )),
        ], shape.spreads.map(spread => spread.conditional ? `Partial<${spread.name}>` : spread.name))
    }

    if (shape.variants.length < 1) return 'never'

    return shape.variants.map(renderObjectShape).join(' | ')
}

const renderFieldValue = (field: RenderableFieldValue): RenderableTypeValue => {
    switch (field.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return field.typeTs
        case VALUE_MODEL_KIND.TYPENAME:
            return renderStringLiteralUnion(field.typeNames)
        case VALUE_MODEL_KIND.ENUM:
            return field.name
        case VALUE_MODEL_KIND.OBJECT:
            return field.renderAsReference && field.renderAliasName
                ? field.renderAliasName
                : field.shape
                    ? renderObjectShape(field.shape)
                    : 'unknown'
        case VALUE_MODEL_KIND.UNION:
            return renderUnionShape(field.shape)
        default:
            console.warn('Unknown type')
            return 'unknown'
    }
}

const renderFragmentRoot = (
    fragment: RenderableFragmentModel
): string => fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
    ? fragment.root.variants.map(renderObjectShape).join(' | ')
    : renderObjectShape(fragment.root.shape)

const renderVariableValue = (
    value: PlannedVariableValue,
    aliasedVariableObjectTypeNames: Set<string>
): RenderableTypeValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return value.typeTs
        case VALUE_MODEL_KIND.ENUM:
            return value.name
        case VALUE_MODEL_KIND.OBJECT:
            if (value.renderAsReference && value.renderAliasName) {
                return value.renderAliasName
            }
            if (value.typeName && aliasedVariableObjectTypeNames.has(value.typeName)) {
                return getVariableObjectAliasName(value.typeName)
            }
            return renderVariableObject(value.fields, aliasedVariableObjectTypeNames)
        default:
            console.warn('Unknown variable type')
            return 'unknown'
    }
}

const renderVariableObject = (fields: PlannedVariableField[], aliasedVariableObjectTypeNames: Set<string>): string => {
    if (!fields.length) return '{ [key: string]: never }'

    return [
        '{',
        ...fields.map(field =>
            indent(`${renderFieldRow(
                field.name,
                renderNullableTypeRef(
                    field.typeRef,
                    renderVariableValue(field.value, aliasedVariableObjectTypeNames)
                ),
                field.optional
            )}`)
        ),
        '}',
    ].join('\n')
}

const renderOperationDeclaration = (
    operationName: string,
    operation: RenderableOperationModel,
    aliasedVariableObjectTypeNames: Set<string>
): string => {
    const exportName = uncapitalize(operationName)
    const variablesType = operation.variables.length > 0
        ? `Exact<${renderVariableObject(operation.variables, aliasedVariableObjectTypeNames)}>`
        : renderVariableObject(operation.variables, aliasedVariableObjectTypeNames)

    return [
        `export type ${operationName}Variables = ${variablesType}`,
        `export type ${operationName}Payload = ${renderObjectShape(operation.resultShape)}`,
        `export const ${exportName}: TypedDocumentNode<${operationName}Payload, ${operationName}Variables>`,
        `export default ${exportName}`,
    ].map(block => indent(block)).join('\n\n')
}

export const renderDeclaration = (
    path: string,
    models: RenderableDocumentModels,
    importsMap: Map<string, string>
): string => {
    if (!models.fragments.size && !models.operations.size) return ''

    const declarationRowsBlocks: string[] = []

    if (models.operations.size > 0) {
        declarationRowsBlocks.push(indent('import type { TypedDocumentNode } from \'@graphql-typed-document-node/core\''))
    }

    if (importsMap.size) {
        const typesBlock: string[] = []

        for (const name of [ ...importsMap.keys() ].sort()) {
            typesBlock.push(indent(`import type { ${name} } from '${importsMap.get(name)}'`))
        }
        declarationRowsBlocks.push(typesBlock.join('\n'))
    }

    const aliasedVariableObjectTypeNames = new Set(models.variableAliases.map(alias => alias.typeName))

    models.variableAliases.forEach(({ aliasName, fields }) => {
        declarationRowsBlocks.push(indent(`export type ${aliasName} = ${renderVariableObject(
            fields,
            aliasedVariableObjectTypeNames
        )}`))
    })

    models.outputAliases.forEach(({ aliasName, shape }: RenderableOutputAlias) => {
        declarationRowsBlocks.push(indent(`export type ${aliasName} = ${renderObjectShape(shape)}`))
    })

    for (const [ key, fragment ] of models.fragments.entries()) {
        declarationRowsBlocks.push(indent(`export type ${key} = ${renderFragmentRoot(fragment)}`))
    }

    for (const [ key, operation ] of models.operations.entries()) {
        declarationRowsBlocks.push(
            renderOperationDeclaration(
                getOperationTypeName(key, operation.operationType),
                operation,
                aliasedVariableObjectTypeNames
            )
        )
    }

    return [
        `declare module '${path}' {`,
        declarationRowsBlocks.filter(Boolean).join('\n\n'),
        `}`,
    ].join('\n')
}

export const renderDeclarations = (
    documentBundles: DocumentModelBundle[],
    documentModuleSpecifier: (location: string | undefined) => string
): string => documentBundles
    .map(({ location, imports, models }) =>
        renderDeclaration(
            documentModuleSpecifier(location),
            models,
            imports
        )
    )
    .filter(Boolean)
    .join('\n\n')
