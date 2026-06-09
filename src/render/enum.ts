import type { EnumModel } from '../models/types'

import { indent } from '../lib/strings'
import { renderJsDoc } from './jsdoc'

const renderStringLiteral = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

const sortEnumEntries = (enums: Map<string, EnumModel>) => [ ...enums.entries() ]
    .sort(([ leftName ], [ rightName ]) => leftName.localeCompare(rightName))

const renderEnumDeclaration = (
    enumName: string,
    enumModel: EnumModel
): string => [
    renderJsDoc(enumModel),
    `export enum ${enumName} {`,
    ...enumModel.entries.flatMap(({ name, value, description, deprecationReason }) => {
        const jsDoc = renderJsDoc({ description, deprecationReason }, '\t')

        return [
            ...(jsDoc ? [ jsDoc ] : []),
            indent(`${name} = ${renderStringLiteral(value)},`),
        ]
    }),
    '}',
].filter(Boolean).join('\n')

export const renderEnumsDeclaration = (enums: Map<string, EnumModel>) => sortEnumEntries(enums)
    .map(([ enumName, enumModel ]) => renderEnumDeclaration(enumName, enumModel))
    .join('\n\n')
