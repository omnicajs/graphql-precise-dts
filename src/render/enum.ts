import type { EnumValueEntries } from '../models/types'

import { indent } from '../lib/strings'

const renderStringLiteral = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

const sortEnumEntries = (enums: Map<string, EnumValueEntries>) => [ ...enums.entries() ]
    .sort(([ leftName ], [ rightName ]) => leftName.localeCompare(rightName))

const renderEnumDeclaration = (
    enumName: string,
    values: EnumValueEntries
): string => [
    `export enum ${enumName} {`,
    ...values.map(({ name, value }) => indent(`${name} = ${renderStringLiteral(value)},`)),
    '}',
].join('\n')

export const renderEnumsDeclaration = (enums: Map<string, EnumValueEntries>) => sortEnumEntries(enums)
    .map(([ enumName, values ]) => renderEnumDeclaration(enumName, values))
    .join('\n\n')
