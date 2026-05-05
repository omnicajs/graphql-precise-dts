import type { ModelSchemaRegistry } from '../models/registry'
import type { Scalars } from '../scalars/types'
import type {
    EnumValueEntries,
    ScalarModelShape,
} from '../models/types'

import { indent } from '../lib/strings'
import { isScalarPrimitiveKey } from '../scalars/builder'
import { renderStringLiteralUnion } from './basic'

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
        '};',
    ].join('\n')
}

const renderEnumsDeclarations = (enums: Map<string, EnumValueEntries>): string[] => [ ...enums.entries() ]
    .map(([ enumName, enumDefinition ]) => `export type ${enumName} = ${renderStringLiteralUnion(
        enumDefinition.map(({ value }) => String(value))
    )}`)

export const renderSchemaDeclaration = (schemaRegistry: ModelSchemaRegistry) => [
    renderScalarsDeclaration(schemaRegistry.scalars),
    ...renderEnumsDeclarations(schemaRegistry.enums),
].filter(Boolean).join('\n\n')
