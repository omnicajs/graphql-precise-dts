import type { EnumModel } from '../models/types'
import type { NamingConvention } from '../naming'

import { assertUniqueRenderedEnums } from '../diagnostics/enum-errors'
import { createNamingConvention } from '../naming'
import { indent } from '../lib/strings'
import { renderJsDoc } from './jsdoc'

const renderStringLiteral = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

const sortEnumEntries = (enums: Map<string, EnumModel>) => [ ...enums.entries() ]
    .sort(([ leftName ], [ rightName ]) => leftName.localeCompare(rightName))

const renderEnumDeclaration = (
    enumName: string,
    enumModel: EnumModel,
    naming: NamingConvention
): string => [
    renderJsDoc(enumModel),
    `export enum ${naming.typeName(enumName)} {`,
    ...enumModel.entries.flatMap(({ name, value, description, deprecationReason }) => {
        const jsDoc = renderJsDoc({ description, deprecationReason }, '\t')

        return [
            ...(jsDoc ? [ jsDoc ] : []),
            indent(`${naming.enumValue(name)} = ${renderStringLiteral(value)},`),
        ]
    }),
    '}',
].filter(Boolean).join('\n')

export const renderEnumsDeclaration = (
    enums: Map<string, EnumModel>,
    naming: NamingConvention = createNamingConvention()
) => {
    assertUniqueRenderedEnums(enums, naming)

    return sortEnumEntries(enums)
        .map(([ enumName, enumModel ]) => renderEnumDeclaration(enumName, enumModel, naming))
        .join('\n\n')
}
