import type { DocumentModelBundle } from '../plan/document-model-bundles'
import type { NamingConvention } from '../naming'
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

import { createNamingConvention } from '../naming'
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

import {
    RENDER_STRATEGY,
    RENDERABLE_UNION_SHAPE,
} from '../plan/renderable/kinds'
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

const renderObjectShape = (
    { typename, rows, spreads }: RenderableObjectShape,
    naming: NamingConvention
): string => renderObjectType([
    ...(typename ? [ renderTypenameRow(typename.typeNames, typename.required) ] : []),
    ...rows.map(field => renderFieldRow(
        field.name,
        renderNullableTypeRef(
            field.typeRef,
            field.overrideTypeTs ?? renderFieldValue(field.value, naming)
        ),
        field.conditional
    )),
], spreads.map(spread => {
    const name = naming.fragmentName(spread.name)
    return spread.conditional ? `Partial<${name}>` : name
}))

const renderUnionShape = (shape: RenderableUnionShape, naming: NamingConvention): string => {
    if (shape.kind === RENDERABLE_UNION_SHAPE.COLLAPSED) {
        return renderObjectType([
            renderTypenameRow(shape.typename.typeNames, shape.typename.required),
            ...shape.rows.map(field => renderFieldRow(
                field.name,
                renderNullableTypeRef(
                    field.typeRef,
                    field.overrideTypeTs ?? renderFieldValue(field.value, naming)
                ),
                field.conditional
            )),
        ], shape.spreads.map(spread => {
            const name = naming.fragmentName(spread.name)
            return spread.conditional ? `Partial<${name}>` : name
        }))
    }

    if (shape.variants.length < 1) return 'never'

    return shape.variants.map(variant => renderObjectShape(variant, naming)).join(' | ')
}

const renderFieldValue = (field: RenderableFieldValue, naming: NamingConvention): RenderableTypeValue => {
    switch (field.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return field.typeTs
        case VALUE_MODEL_KIND.TYPENAME:
            return renderStringLiteralUnion(field.typeNames)
        case VALUE_MODEL_KIND.ENUM:
            return naming.typeName(field.name)
        case VALUE_MODEL_KIND.OBJECT:
            return field.renderStrategy === RENDER_STRATEGY.REFERENCE
                ? field.referenceName
                : renderObjectShape(field.shape, naming)
        case VALUE_MODEL_KIND.UNION:
            return renderUnionShape(field.shape, naming)
        case VALUE_MODEL_KIND.UNKNOWN:
            return 'unknown'
    }
}

const renderFragmentRoot = (
    fragment: RenderableFragmentModel,
    naming: NamingConvention
): string => fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
    ? fragment.root.variants.map(variant => renderObjectShape(variant, naming)).join(' | ')
    : renderObjectShape(fragment.root.shape, naming)

const renderVariableValue = (
    value: RenderableVariableValue,
    naming: NamingConvention
): RenderableTypeValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
            return value.typeTs
        case VALUE_MODEL_KIND.ENUM:
            return naming.typeName(value.name)
        case VALUE_MODEL_KIND.OBJECT:
            return value.renderStrategy === RENDER_STRATEGY.REFERENCE
                ? value.referenceName
                : renderVariableObject(value.fields, naming)
        case VALUE_MODEL_KIND.UNKNOWN:
            return 'unknown'
    }
}

const renderVariableObject = (
    fields: RenderableVariableField[],
    naming: NamingConvention
): string => {
    if (!fields.length) return '{ [key: string]: never }'

    return [
        '{',
        ...fields.map(field =>
            indent(`${renderFieldRow(
                field.name,
                renderNullableTypeRef(
                    field.typeRef,
                    renderVariableValue(field.value, naming)
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
    naming: NamingConvention
): string => {
    const exportName = uncapitalize(operationName)
    const variablesType = operation.variables.length > 0
        ? `Exact<${renderVariableObject(operation.variables, naming)}>`
        : renderVariableObject(operation.variables, naming)

    return [
        `export type ${operationName}Variables = ${variablesType}`,
        `export type ${operationName}Payload = ${renderObjectShape(operation.resultShape, naming)}`,
        `export const ${exportName}: TypedDocumentNode<${operationName}Payload, ${operationName}Variables>`,
        `export default ${exportName}`,
    ].map(block => indent(block)).join('\n\n')
}

const hasOperationVariables = (operations: Map<string, RenderableOperationModel>): boolean =>
    [ ...operations.values() ].some(operation => operation.variables.length > 0)

const hasRenderableModels = ({ fragments, operations }: RenderableDocumentModels): boolean =>
    fragments.size > 0 || operations.size > 0

export const renderDeclaration = (
    path: string,
    models: RenderableDocumentModels,
    importsMap: Map<string, string>,
    naming: NamingConvention,
    schemaModulePath?: string
): string => {
    if (!hasRenderableModels(models)) return ''

    const declarationRowsBlocks: string[] = []

    if (schemaModulePath && hasOperationVariables(models.operations)) {
        declarationRowsBlocks.push(indent(`import type { Exact } from '${schemaModulePath}'`))
    }
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
        declarationRowsBlocks.push(indent(`type ${aliasName} = ${renderVariableObject(fields, naming)}`))
    })

    models.outputAliases.forEach(({ aliasName, shape }: RenderableOutputAlias) => {
        declarationRowsBlocks.push(indent(`type ${aliasName} = ${renderObjectShape(shape, naming)}`))
    })

    for (const [ key, fragment ] of models.fragments.entries()) {
        declarationRowsBlocks.push(indent(`export type ${naming.fragmentName(key)} = ${renderFragmentRoot(fragment, naming)}`))
    }

    for (const [ key, operation ] of models.operations.entries()) {
        declarationRowsBlocks.push(
            renderOperationDeclaration(
                getOperationTypeName(key, operation.operationType, naming),
                operation,
                naming
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
    documentModuleSpecifier: (location: string | undefined) => string,
    schemaModulePath?: string,
    naming: NamingConvention = createNamingConvention()
): string => documentBundles
    .map(({ location, imports, models }) =>
        renderDeclaration(
            documentModuleSpecifier(location),
            models,
            imports,
            naming,
            schemaModulePath
        )
    )
    .filter(Boolean)
    .join('\n\n')
