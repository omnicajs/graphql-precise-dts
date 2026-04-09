import type {
    DocumentModels,
    FieldValue,
    FragmentModel,
    FragmentRoot,
    InputField,
    InputValue,
    OperationModel,
    SelectionModel,
} from '../models/types'
import type { TypeRef } from '../models/types'

import { capitalize, indent } from '../lib/strings'
import { hasRootSpreadWithSameTypeNames } from './typename'
import { renderStringLiteralUnion } from './basic'
import { resolveTypenameSelection } from './typename'
import { uncapitalize } from '../lib/strings'

import {
    FragmentRootKind,
    SelectionModelKind,
    TypeRefKind,
    ValueModelKind,
} from '../models/kinds'

type RenderedSelections = {
    rows: string[];
    spreads: string[];
}

const renderFieldRow = (
    name: string,
    value: string,
    optional = false
): string => `${name}${optional ? '?' : ''}: ${value};`

const wrapNullable = (value: string): string => `${value} | null`

const renderNullableTypeRef = (typeRef: TypeRef, value: string): string => {
    switch (typeRef.kind) {
        case TypeRefKind.NAMED:
            return wrapNullable(value)
        case TypeRefKind.LIST:
            return wrapNullable(`Array<${renderNullableTypeRef(typeRef.ofType, value)}>`)
        case TypeRefKind.NON_NULL:
            return renderNonNullTypeRef(typeRef.ofType, value)
    }
}

const renderNonNullTypeRef = (typeRef: TypeRef, value: string): string => {
    switch (typeRef.kind) {
        case TypeRefKind.NAMED:
            return value
        case TypeRefKind.LIST:
            return `Array<${renderNullableTypeRef(typeRef.ofType, value)}>`
        case TypeRefKind.NON_NULL:
            return renderNonNullTypeRef(typeRef.ofType, value)
    }
}

const renderSelections = (
    selections: SelectionModel[],
    withinConditional = false
): RenderedSelections => selections.reduce<RenderedSelections>((result, selection) => {
    const isConditional = withinConditional || !!selection.conditional

    switch (selection.kind) {
        case SelectionModelKind.FIELD:
            if (selection.name === '__typename' && selection.responseName === '__typename') {
                return result
            }

            result.rows.push(renderFieldRow(
                selection.responseName,
                renderNullableTypeRef(
                    selection.typeRef,
                    selection.overrideTypeTs ?? renderFieldValue(selection.value)
                ),
                isConditional
            ))
            return result
        case SelectionModelKind.INLINE_FRAGMENT: {
            const nested = renderSelections(selection.selections, isConditional)
            result.rows.push(...nested.rows)
            result.spreads.push(...nested.spreads)
            return result
        }
        case SelectionModelKind.FRAGMENT_SPREAD:
            result.spreads.push(isConditional ? `Partial<${selection.name}>` : selection.name)
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

const renderObjectSelections = (
    fields: SelectionModel[],
    typeNames: string[],
    options?: {
        requiredFallbackTypename?: boolean;
        omitFallbackTypenameWhenSpreadMatches?: boolean;
    }
): string => {
    const fallbackTypeNames = typeNames.filter(Boolean)
    const { rows, spreads } = renderSelections(fields)
    const resolvedTypename = resolveTypenameSelection(fields, fallbackTypeNames)
    const shouldOmitFallbackTypename = options?.omitFallbackTypenameWhenSpreadMatches
        && hasRootSpreadWithSameTypeNames(fields, fallbackTypeNames)

    return renderObjectType([
        ...(resolvedTypename.present
            ? [ renderTypenameRow(resolvedTypename.typeNames, resolvedTypename.required) ]
            : fallbackTypeNames.length === 0 || shouldOmitFallbackTypename
                ? []
                : [ renderTypenameRow(fallbackTypeNames, options?.requiredFallbackTypename) ]),
        ...rows,
    ], spreads)
}

const renderFragmentUnionRoot = (
    root: Extract<FragmentRoot, { kind: FragmentRootKind.UNION }>
): string => root.variants
    .map(variant => renderObjectSelections(variant.fields, [ variant.typeName ]))
    .join(' | ')

const renderFragmentObjectRoot = (
    fields: SelectionModel[],
    rootTypeNames: string[]
): string => renderObjectSelections(fields, rootTypeNames, {
    omitFallbackTypenameWhenSpreadMatches: true,
})

const renderFieldValue = (field: FieldValue): string => {
    switch (field.kind) {
        case ValueModelKind.SCALAR:
            return field.typeTs
        case ValueModelKind.TYPENAME:
            return renderStringLiteralUnion(field.typeNames)
        case ValueModelKind.ENUM:
            return field.name
        case ValueModelKind.OBJECT:
            return renderObjectSelections(field.fields, field.typeNames ?? [], {
                omitFallbackTypenameWhenSpreadMatches: true,
            })
        case ValueModelKind.UNION:
            return field.variants
                .map(variant => renderObjectSelections(
                    variant.fields,
                    [ variant.typeName ],
                    { requiredFallbackTypename: true }
                ))
                .join(' | ')
        default:
            console.warn('Unknown type')
            return 'unknown'
    }
}

const renderTypeBody = (fragment: FragmentModel): string => {
    return fragment.root.kind === FragmentRootKind.UNION
        ? renderFragmentUnionRoot(fragment.root)
        : renderFragmentObjectRoot(
            fragment.root.fields,
            fragment.onTypeNames ?? [ fragment.onType ]
        )
}

const renderInputValue = (value: InputValue): string => {
    switch (value.kind) {
        case ValueModelKind.SCALAR:
            return value.typeTs
        case ValueModelKind.ENUM:
            return value.name
        case ValueModelKind.OBJECT:
            return renderInputObject(value.fields)
        default:
            console.warn('Unknown input type')
            return 'unknown'
    }
}

const renderInputObject = (fields: InputField[]): string => {
    if (!fields.length) return '{ [key: string]: never }'

    return [
        '{',
        ...fields.map(field =>
            indent(`${renderFieldRow(
                field.name,
                renderNullableTypeRef(field.typeRef, renderInputValue(field.value)),
                field.optional
            )}`)
        ),
        '}',
    ].join('\n')
}

const renderOperationResult = (operation: OperationModel): string => {
    return renderObjectSelections(operation.result, [ operation.onType ])
}

const renderOperationDeclaration = (
    operationName: string,
    operation: OperationModel
): string => {
    const exportName = uncapitalize(operationName)

    return [
        `export type ${operationName} = ${renderOperationResult(operation)}`,
        `export type ${operationName}Variables = Exact<${renderInputObject(operation.variables)}>`,
        `export const ${exportName}: TypedDocumentNode<${operationName}, ${operationName}Variables>`,
        `export default ${exportName}`,
    ].join('\n\n')
}

export const renderDeclaration = (
    path: string,
    { fragments, operations }: DocumentModels,
    importsMap: Map<string, string>
): string => {
    if (!fragments.size && !operations.size) return ''

    const declarationRowsBlocks: string[] = []

    if (operations.size > 0) {
        declarationRowsBlocks.push(indent('import type { TypedDocumentNode } from \'@graphql-typed-document-node/core\''))
    }

    if (importsMap.size) {
        const typesBlock: string[] = []

        for (const name of [ ...importsMap.keys() ].sort()) {
            typesBlock.push(indent(`import type { ${name} } from '${importsMap.get(name)}'`))
        }
        declarationRowsBlocks.push(typesBlock.join('\n'))
    }

    for (const [key, fragment] of fragments.entries()) {
        declarationRowsBlocks.push(indent(`export type ${key} = ${renderTypeBody(fragment)}`))
    }

    for (const [key, operation] of operations.entries()) {
        declarationRowsBlocks.push(
            indent(renderOperationDeclaration(capitalize(key) + capitalize(operation.operationType), operation))
        )
    }

    return [
        `declare module '${path}' {`,
        declarationRowsBlocks.filter(Boolean).join('\n\n'),
        `}`,
    ].join('\n')
}
