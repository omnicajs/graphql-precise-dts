import type { ScalarModelShape } from '../models/types'
import type { Scalars } from '../scalars/types'
import type {
    SchemaObjectModel,
    SchemaOutputModel,
} from '../models/generation'
import type { TsType } from '../ts-type'

import { indent } from '../lib/strings'
import { isScalarPrimitiveKey } from '../scalars/builder'
import {
    intersectionTsType,
    namedTsType,
    renderTsType,
} from '../ts-type'

import { GENERATED_ENUMS_FILE_NAME } from '../path'

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
): string => indent(`${scalarName}: { input: ${scalar.input}; output: ${scalar.output}; };`)

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

const renderEnumImports = (enumImports: Set<string>): string => {
    const names = [ ...enumImports ].sort((left, right) => left.localeCompare(right))
    if (!names.length) return ''
    if (names.length === 1) return `import type { ${names[0]} } from './${GENERATED_ENUMS_FILE_NAME}'`

    return [
        `import type {`,
        ...names.map(name => indent(name + ',')),
        `} from './${GENERATED_ENUMS_FILE_NAME}'`,
    ].join('\n')
}

const renderTypeDeclaration = (
    typeName: string,
    type: TsType
): string => `export type ${typeName} = ${renderTsType(type)}`

const sortEntriesByName = <TValue>(entries: Map<string, TValue>) => [ ...entries.entries() ]
    .sort(([ leftName ], [ rightName ]) => leftName.localeCompare(rightName))

const renderTypeDeclarations = (
    types: Map<string, TsType>
): string[] => sortEntriesByName(types).map(([ typeName, type ]) => renderTypeDeclaration(typeName, type))

const renderObjectTypeDeclaration = (
    typeName: string,
    model: SchemaObjectModel
): string => renderTypeDeclaration(
    typeName,
    model.interfaces.length
        ? intersectionTsType(
            ...model.interfaces.map(namedTsType),
            model.fields
        )
        : model.fields
)

const renderObjectTypeDeclarations = (
    types: Map<string, SchemaObjectModel>
): string[] => sortEntriesByName(types).map(([ typeName, model ]) => renderObjectTypeDeclaration(typeName, model))

export const renderSchemaDeclaration = (
    schema: SchemaOutputModel
) => [
    renderEnumImports(schema.enumReferences),
    SCHEMA_HELPER_DECLARATIONS,
    renderScalarsDeclaration(schema.scalars),
    ...renderTypeDeclarations(schema.inputTypes),
    ...renderTypeDeclarations(schema.interfaceTypes),
    ...renderObjectTypeDeclarations(schema.objectTypes),
    ...renderTypeDeclarations(schema.unionTypes),
    ...renderTypeDeclarations(schema.fieldArgs),
].filter(Boolean).join('\n\n')
