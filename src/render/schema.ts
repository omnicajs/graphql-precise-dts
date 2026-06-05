import type { ScalarModelShape } from '../models/types'
import type { Scalars } from '../scalars/types'
import type { SchemaOutputModel } from '../models/generation'

import { indent } from '../lib/strings'
import { isScalarPrimitiveKey } from '../scalars/builder'

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

export const renderSchemaDeclaration = (schema: SchemaOutputModel) => [
    renderScalarsDeclaration(schema.scalars),
].filter(Boolean).join('\n\n')
