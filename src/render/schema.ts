import type { NamingConvention } from '../naming'
import type { ScalarModelShape } from '../models/types'
import type { Scalars } from '../scalars/types'
import type {
    SchemaFieldArgTypeModel,
    SchemaObjectModel,
    SchemaOutputModel,
} from '../models/generation'
import type { TsType } from '../ts-type'

import { assertUniqueRenderedSchemaNames } from '../diagnostics/schema-errors'
import { createNamingConvention } from '../naming'
import { indent } from '../lib/strings'
import { isScalarPrimitiveKey } from '../scalars/builder'
import { renderJsDoc } from './jsdoc'
import { renderTsType } from '../ts-type'

import {
    arrayTsType,
    genericTsType,
    intersectionTsType,
    namedTsType,
    tupleTsType,
    unionTsType,
} from '../ts-type'

import { GENERATED_ENUMS_FILE_NAME } from '../path'
import { TS_TYPE_KIND } from '../ts-type'

const EXACT_TYPE_DECLARATION = 'export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }'
const MAYBE_PROMISE_TYPE_DECLARATION = 'export type MaybePromise<T> = T | Promise<T>'

const SCHEMA_HELPER_DECLARATIONS = [
    EXACT_TYPE_DECLARATION,
    MAYBE_PROMISE_TYPE_DECLARATION,
].join('\n')

const primitiveScalarOrder = [
    'ID',
    'String',
    'Boolean',
    'Int',
    'Float',
] as const satisfies ReadonlyArray<keyof Scalars>

const sortScalarEntries = (scalars: Map<string, ScalarModelShape>) => [ ...scalars.entries() ]
    .sort(([ leftName ], [ rightName ]) => {
        const leftPrimitive = isScalarPrimitiveKey(leftName)
        const rightPrimitive = isScalarPrimitiveKey(rightName)

        if (leftPrimitive && rightPrimitive) {
            return primitiveScalarOrder.indexOf(leftName) - primitiveScalarOrder.indexOf(rightName)
        }

        if (leftPrimitive) return -1
        if (rightPrimitive) return 1

        return leftName.localeCompare(rightName)
    })

const renderScalarEntry = (
    scalarName: string,
    scalar: ScalarModelShape
): string => [
    renderJsDoc({
        description: scalar.description,
        see: scalar.specifiedByUrl,
    }, '\t'),
    indent(`${scalarName}: { input: ${scalar.input}; output: ${scalar.output}; };`),
].filter(Boolean).join('\n')

const renderScalarsDeclaration = (scalars: Map<string, ScalarModelShape>): string => {
    const scalarEntries = sortScalarEntries(scalars)
    if (!scalarEntries.length) return ''

    return [
        'export type Scalars = {',
        ...scalarEntries.map(([ scalarName, scalarDefinition ]) =>
            renderScalarEntry(scalarName, scalarDefinition)
        ),
        '}',
    ].join('\n')
}

const renderEnumImports = (
    enumImports: Set<string>,
    naming: NamingConvention
): string => {
    const names = [ ...enumImports ]
        .map(name => naming.typeName(name))
        .sort((left, right) => left.localeCompare(right))

    if (!names.length) return ''
    if (names.length === 1) return `import type { ${names[0]} } from './${GENERATED_ENUMS_FILE_NAME}'`

    return [
        `import type {`,
        ...names.map(name => indent(name + ',')),
        `} from './${GENERATED_ENUMS_FILE_NAME}'`,
    ].join('\n')
}

const renderTypeDeclarations = (
    types: Map<string, TsType>,
    schemaTypeNames: Set<string>,
    naming: NamingConvention
): string[] => sortEntriesByName(types).map(([ typeName, type ]) => renderTypeDeclaration(
    naming.typeName(typeName),
    normalizeSchemaTypeReferences(type, schemaTypeNames, naming)
))

const renderTypeDeclaration = (
    typeName: string,
    type: TsType
): string => [
    renderJsDoc(type),
    `export type ${typeName} = ${renderTsType(type)}`,
].filter(Boolean).join('\n')

const sortEntriesByName = <TValue>(entries: Map<string, TValue>) => [ ...entries.entries() ]
    .sort(([ leftName ], [ rightName ]) => leftName.localeCompare(rightName))

const makeSchemaTypeNameSet = (schema: SchemaOutputModel): Set<string> => new Set([
    ...schema.enumReferences,
    ...schema.inputTypes.keys(),
    ...schema.interfaceTypes.keys(),
    ...schema.objectTypes.keys(),
    ...schema.unionTypes.keys(),
])

const normalizeSchemaTypeReferences = (
    type: TsType,
    schemaTypeNames: Set<string>,
    naming: NamingConvention
): TsType => {
    switch (type.kind) {
        case TS_TYPE_KIND.NAMED:
            return schemaTypeNames.has(type.name) ? namedTsType(naming.typeName(type.name)) : type
        case TS_TYPE_KIND.ARRAY:
            return arrayTsType(normalizeSchemaTypeReferences(type.ofType, schemaTypeNames, naming))
        case TS_TYPE_KIND.UNION:
            return unionTsType(...type.types.map(current => normalizeSchemaTypeReferences(current, schemaTypeNames, naming)))
        case TS_TYPE_KIND.INTERSECTION:
            return intersectionTsType(...type.types.map(current => normalizeSchemaTypeReferences(current, schemaTypeNames, naming)))
        case TS_TYPE_KIND.GENERIC:
            return genericTsType(type.name, ...type.args.map(current => normalizeSchemaTypeReferences(current, schemaTypeNames, naming)))
        case TS_TYPE_KIND.OBJECT:
            return {
                ...type,
                fields: type.fields.map(field => ({
                    ...field,
                    type: normalizeSchemaTypeReferences(field.type, schemaTypeNames, naming),
                })),
            }
        case TS_TYPE_KIND.TUPLE:
            return tupleTsType(...type.items.map(current => normalizeSchemaTypeReferences(current, schemaTypeNames, naming)))
        default:
            return type
    }
}

const renderObjectTypeDeclaration = (
    typeName: string,
    model: SchemaObjectModel,
    schemaTypeNames: Set<string>,
    naming: NamingConvention
): string => renderTypeDeclaration(
    naming.typeName(typeName),
    {
        ...model.interfaces.length
            ? intersectionTsType(
                ...model.interfaces.map(name => namedTsType(naming.typeName(name))),
                normalizeSchemaTypeReferences(model.fields, schemaTypeNames, naming)
            )
            : normalizeSchemaTypeReferences(model.fields, schemaTypeNames, naming),
        ...(model.description && { description: model.description }),
    }
)

const renderObjectTypeDeclarations = (
    types: Map<string, SchemaObjectModel>,
    schemaTypeNames: Set<string>,
    naming: NamingConvention
): string[] => sortEntriesByName(types).map(([ typeName, model ]) =>
    renderObjectTypeDeclaration(typeName, model, schemaTypeNames, naming)
)

const sortFieldArgTypesByName = (
    fieldArgTypes: SchemaFieldArgTypeModel[],
    naming: NamingConvention
) => [ ...fieldArgTypes ].sort((left, right) =>
    naming.fieldArgTypeName(left.parentTypeName, left.fieldName)
        .localeCompare(naming.fieldArgTypeName(right.parentTypeName, right.fieldName))
)

const renderFieldArgTypeDeclarations = (
    fieldArgTypes: SchemaFieldArgTypeModel[],
    schemaTypeNames: Set<string>,
    naming: NamingConvention
): string[] => sortFieldArgTypesByName(fieldArgTypes, naming).map(({ parentTypeName, fieldName, type }) =>
    renderTypeDeclaration(
        naming.fieldArgTypeName(parentTypeName, fieldName),
        normalizeSchemaTypeReferences(type, schemaTypeNames, naming)
    )
)

export const renderSchemaDeclaration = (
    schema: SchemaOutputModel,
    naming: NamingConvention = createNamingConvention()
) => {
    const schemaTypeNames = makeSchemaTypeNameSet(schema)
    assertUniqueRenderedSchemaNames(schema, naming)

    return [
        renderEnumImports(schema.enumReferences, naming),
        SCHEMA_HELPER_DECLARATIONS,
        renderScalarsDeclaration(schema.scalars),
        ...renderTypeDeclarations(schema.inputTypes, schemaTypeNames, naming),
        ...renderTypeDeclarations(schema.interfaceTypes, schemaTypeNames, naming),
        ...renderObjectTypeDeclarations(schema.objectTypes, schemaTypeNames, naming),
        ...renderTypeDeclarations(schema.unionTypes, schemaTypeNames, naming),
        ...renderFieldArgTypeDeclarations(schema.fieldArgTypes, schemaTypeNames, naming),
    ].filter(Boolean).join('\n\n')
}
