import type { DocumentModelBundle } from '../plan/document-model-bundles'
import type { TsType } from '../ts-type'
import type { TypeRef } from '../models/types'

import type {
    RenderableDocumentModels,
    RenderableFragmentModel,
    RenderableOperationModel,
    RenderableOutputAlias,
    RenderableVariableAlias,
} from '../plan/renderable/types'

import type {
    RenderableFieldValue,
    RenderableObjectShape,
    RenderableUnionShape,
    RenderableVariableField,
    RenderableVariableValue,
} from '../plan/renderable/types'

import { getOperationTypeName } from '../plan/naming'
import { renderStringLiteralUnion } from './basic'
import {
    makeNullableTsType,
    renderTsType,
} from '../ts-type'
import {
    indent,
    uncapitalize,
} from '../lib/strings'

import { RENDER_STRATEGY } from '../plan/renderable/kinds'
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
            return field.renderStrategy === RENDER_STRATEGY.REFERENCE
                ? field.referenceName
                : renderObjectShape(field.shape)
        case VALUE_MODEL_KIND.UNION:
            return renderUnionShape(field.shape)
        case VALUE_MODEL_KIND.UNKNOWN:
            return 'unknown'
    }
}

const renderFragmentRoot = (
    fragment: RenderableFragmentModel
): string => fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
    ? fragment.root.variants.map(renderObjectShape).join(' | ')
    : renderObjectShape(fragment.root.shape)

const renderVariableValue = (
    value: RenderableVariableValue
): RenderableTypeValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return value.typeTs
        case VALUE_MODEL_KIND.ENUM:
            return value.name
        case VALUE_MODEL_KIND.OBJECT:
            return value.renderStrategy === RENDER_STRATEGY.REFERENCE
                ? value.referenceName
                : renderVariableObject(value.fields)
        case VALUE_MODEL_KIND.UNKNOWN:
            return 'unknown'
    }
}

const renderVariableObject = (fields: RenderableVariableField[]): string => {
    if (!fields.length) return '{ [key: string]: never }'

    return [
        '{',
        ...fields.map(field =>
            indent(`${renderFieldRow(
                field.name,
                renderNullableTypeRef(
                    field.typeRef,
                    renderVariableValue(field.value)
                ),
                field.optional
            )}`)
        ),
        '}',
    ].join('\n')
}

const renderOperationDeclaration = (
    operationName: string,
    operation: RenderableOperationModel
): string => {
    const exportName = uncapitalize(operationName)
    const variablesType = operation.variables.length > 0
        ? `Exact<${renderVariableObject(operation.variables)}>`
        : renderVariableObject(operation.variables)

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

    models.variableAliases.forEach(({ aliasName, fields }: RenderableVariableAlias) => {
        declarationRowsBlocks.push(indent(`export type ${aliasName} = ${renderVariableObject(fields)}`))
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
                operation
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
