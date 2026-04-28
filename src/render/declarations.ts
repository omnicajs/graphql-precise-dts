import type {
    DocumentFieldValue,
    DocumentFragmentModel,
    DocumentInputField,
    DocumentInputValue,
} from '../plan/document-models-types'
import type { DocumentModelBundle } from '../plan/document-model-bundles'
import type {
    DocumentModels,
    DocumentOperationModel,
    DocumentSelectionModel,
} from '../plan/document-models-types'
import type { TsType } from '../ts-type'
import type { TypeRef } from '../models/types'

import { getInputObjectAliasName } from '../plan/document-models'
import { getOperationTypeName } from '../lib/operation-name'
import {
    hasAliasedRootTypenameSelection,
    hasRootSpreadWithSameTypeNames,
} from './typename'
import { indent } from '../lib/strings'
import { makeNullableTsType } from '../ts-type'
import { normalizeSelections } from './selection-normalization'
import { renderStringLiteralUnion } from './basic'
import { renderTsType } from '../ts-type'
import { resolveTypenameSelection } from './typename'
import { uncapitalize } from '../lib/strings'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../models/kinds'

type RenderedSelections = {
    rows: string[];
    spreads: string[];
}

type RenderedUnionVariant = RenderedSelections & {
    typeName: string;
    hasExplicitTypename: boolean;
    hasRequiredExplicitTypename: boolean;
}

type RenderableTypeValue = string | TsType

type NormalizedDocumentSelection = Extract<DocumentSelectionModel, {
    kind: typeof SELECTION_MODEL_KIND.FIELD | typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
}>

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

const renderFieldValue = (field: DocumentFieldValue): RenderableTypeValue => {
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
                : renderObjectSelections(field.fields, field.typeNames ?? [], field.renderOptions)
        case VALUE_MODEL_KIND.UNION:
            return renderUnionVariants(field.variants)
        default:
            console.warn('Unknown type')
            return 'unknown'
    }
}

const renderSelections = (
    selections: DocumentSelectionModel[],
    withinConditional = false
): RenderedSelections => (normalizeSelections(
    (withinConditional
        ? selections.map(selection => ({ ...selection, conditional: true }))
        : selections) as never
) as NormalizedDocumentSelection[]
).reduce<RenderedSelections>((result, selection) => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FIELD:
            if (selection.name === '__typename' && selection.responseName === '__typename') {
                return result
            }

            result.rows.push(renderFieldRow(
                selection.responseName,
                renderNullableTypeRef(
                    selection.typeRef,
                    selection.overrideTypeTs ?? renderFieldValue(selection.value)
                ),
                selection.conditional
            ))
            return result
        case SELECTION_MODEL_KIND.FRAGMENT_SPREAD:
            result.spreads.push(selection.conditional ? `Partial<${selection.name}>` : selection.name)
            return result
        default:
            return result
    }
}, {
    rows: [],
    spreads: [],
})

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

const haveSameRenderedSelections = (
    left: RenderedSelections,
    right: RenderedSelections
): boolean => left.rows.length === right.rows.length
    && left.rows.every((row, index) => row === right.rows[index])
    && left.spreads.length === right.spreads.length
    && left.spreads.every((spread, index) => spread === right.spreads[index])

const renderUnionVariants = (
    variants: Extract<DocumentFieldValue, { kind: typeof VALUE_MODEL_KIND.UNION }>['variants']
): string => {
    const renderedVariants = variants.map((variant): RenderedUnionVariant => {
        const renderedSelections = renderSelections(variant.fields)
        const resolvedTypename = resolveTypenameSelection(variant.fields)

        return {
            ...renderedSelections,
            typeName: variant.typeName,
            hasExplicitTypename: resolvedTypename.present,
            hasRequiredExplicitTypename: resolvedTypename.present && resolvedTypename.required,
        }
    })

    if (renderedVariants.length < 1) return 'never'
    const [ firstVariant ] = renderedVariants

    const hasSameRenderedShape = renderedVariants.every(variant => haveSameRenderedSelections(firstVariant, variant))
    const hasExplicitTypename = renderedVariants.some(variant => variant.hasExplicitTypename)

    if (hasSameRenderedShape) {
        const typeNames = renderedVariants.map(variant => variant.typeName)
        const hasRequiredTypename = !hasExplicitTypename
            || renderedVariants.every(variant => variant.hasRequiredExplicitTypename)

        return renderObjectType([
            renderTypenameRow(typeNames, hasRequiredTypename),
            ...firstVariant.rows,
        ], firstVariant.spreads)
    }

    return variants
        .map(variant => renderObjectSelections(
            variant.fields,
            [ variant.typeName ],
            { requiredFallbackTypename: !hasExplicitTypename }
        )).join(' | ')
}

const renderObjectSelections = (
    fields: DocumentSelectionModel[],
    typeNames: string[],
    options?: {
        requiredFallbackTypename?: boolean;
        dedupeTypenameWithSpread?: boolean;
        dedupeTypenameWithAlias?: boolean;
    }
): string => {
    const fallbackTypeNames = typeNames.filter(Boolean)
    const { rows, spreads } = renderSelections(fields)
    const resolvedTypename = resolveTypenameSelection(fields, fallbackTypeNames)
    const shouldOmitFallbackTypename = (
        options?.dedupeTypenameWithSpread
        && hasRootSpreadWithSameTypeNames(fields, fallbackTypeNames)
    ) || (
        options?.dedupeTypenameWithAlias
        && hasAliasedRootTypenameSelection(fields)
    )

    return renderObjectType([
        ...(resolvedTypename.present
            ? [ renderTypenameRow(resolvedTypename.typeNames, resolvedTypename.required) ]
            : fallbackTypeNames.length === 0 || shouldOmitFallbackTypename
                ? []
                : [ renderTypenameRow(fallbackTypeNames, options?.requiredFallbackTypename) ]),
        ...rows,
    ], spreads)
}

const renderFragmentRoot = (
    fragment: DocumentFragmentModel
): string => fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
    ? fragment.root.variants
        .map(variant => renderObjectSelections(variant.fields, [ variant.typeName ]))
        .join(' | ')
    : renderObjectSelections(fragment.root.fields, fragment.onTypeNames ?? [ fragment.onType ], {
        dedupeTypenameWithSpread: true,
        dedupeTypenameWithAlias: (fragment.onTypeNames ?? [ fragment.onType ]).length === 1,
    })

const renderInputValue = (
    value: DocumentInputValue,
    aliasedInputObjectTypeNames: Set<string>
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
            if (value.typeName && aliasedInputObjectTypeNames.has(value.typeName)) {
                return getInputObjectAliasName(value.typeName)
            }
            return renderInputObject(value.fields, aliasedInputObjectTypeNames)
        default:
            console.warn('Unknown input type')
            return 'unknown'
    }
}

const renderInputObject = (fields: DocumentInputField[], aliasedInputObjectTypeNames: Set<string>): string => {
    if (!fields.length) return '{ [key: string]: never }'

    return [
        '{',
        ...fields.map(field =>
            indent(`${renderFieldRow(
                field.name,
                renderNullableTypeRef(
                    field.typeRef,
                    renderInputValue(field.value, aliasedInputObjectTypeNames)
                ),
                field.optional
            )}`)
        ),
        '}',
    ].join('\n')
}

const renderOperationDeclaration = (
    operationName: string,
    operation: DocumentOperationModel,
    aliasedInputObjectTypeNames: Set<string>
): string => {
    const exportName = uncapitalize(operationName)
    const variablesType = operation.variables.length > 0
        ? `Exact<${renderInputObject(operation.variables, aliasedInputObjectTypeNames)}>`
        : renderInputObject(operation.variables, aliasedInputObjectTypeNames)

    return [
        `export type ${operationName} = ${renderObjectSelections(operation.result, [ operation.onType ], {
            dedupeTypenameWithAlias: true,
        })}`,
        `export type ${operationName}Variables = ${variablesType}`,
        `export const ${exportName}: TypedDocumentNode<${operationName}, ${operationName}Variables>`,
        `export default ${exportName}`,
    ].join('\n\n')
}

export const renderDeclaration = (
    path: string,
    models: DocumentModels,
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

    const aliasedInputObjectTypeNames = new Set(models.inputAliases.map(alias => alias.typeName))

    models.inputAliases.forEach(({ aliasName, fields }) => {
        declarationRowsBlocks.push(indent(`export type ${aliasName} = ${renderInputObject(
            fields,
            aliasedInputObjectTypeNames
        )}`))
    })

    models.outputAliases.forEach(({ aliasName, fields, typeNames, renderOptions }) => {
        declarationRowsBlocks.push(indent(`export type ${aliasName} = ${renderObjectSelections(
            fields,
            typeNames,
            renderOptions
        )}`))
    })

    for (const [ key, fragment ] of models.fragments.entries()) {
        declarationRowsBlocks.push(indent(`export type ${key} = ${renderFragmentRoot(fragment)}`))
    }

    for (const [ key, operation ] of models.operations.entries()) {
        declarationRowsBlocks.push(
            indent(renderOperationDeclaration(
                getOperationTypeName(key, operation.operationType),
                operation,
                aliasedInputObjectTypeNames
            ))
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
