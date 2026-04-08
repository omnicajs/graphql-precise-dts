import type { DefRegistry } from '../../types/registry'
import type {
    EnumDefinitionModel,
    ScalarModel,
} from '../../types/models'
import type { Scalars } from '../../types/scalars'

import { indent } from './primitives-render'
import { isScalarPrimitiveKey } from '../scalar-type-mapping'
import { renderStringLiteralUnion } from './primitives-render'

const primitiveScalarOrder = [
    'ID',
    'String',
    'Boolean',
    'Int',
    'Float',
] as const satisfies ReadonlyArray<keyof Scalars>

const sortScalarEntries = (defScalars: Map<string, ScalarModel>) => [ ...defScalars.entries() ]
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
    scalarDefinition: ScalarModel
): string => indent(`${scalarName}: { input: ${scalarDefinition.input}; output: ${scalarDefinition.output}; };`)

const renderScalarsDeclaration = (defScalars: Map<string, ScalarModel>): string => {
    const scalarEntries = sortScalarEntries(defScalars)
    if (!scalarEntries.length) return ''

    return [
        'export type Scalars = {',
        ...scalarEntries.map(([ scalarName, scalarDefinition ]) =>
            renderScalarEntry(scalarName, scalarDefinition)
        ),
        '};',
    ].join('\n')
}

const renderEnumsDeclarations = (defEnums: Map<string, EnumDefinitionModel>): string[] => [ ...defEnums.entries() ]
    .map(([ enumName, enumDefinition ]) => `export type ${enumName} = ${renderStringLiteralUnion(
        enumDefinition.map(({ value }) => String(value))
    )}`)

export const renderSchemaDeclaration = (defRegistry: DefRegistry) => [
    renderScalarsDeclaration(defRegistry.scalars),
    ...renderEnumsDeclarations(defRegistry.enums),
].filter(Boolean).join('\n\n')
