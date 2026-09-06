import type { NamingConvention } from '@/generation/naming'
import type { SchemaSnapshot } from '@/schema/snapshot/types'

import { renderDocumented } from './jsdoc'

const escapeValue = (value: string): string => `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

export const renderEnums = (
    snapshot: SchemaSnapshot,
    naming: NamingConvention
): string => snapshot.types
    .filter(type => type.kind === 'enum')
    .map(type => renderDocumented([
        `export enum ${naming.typeName(type.id)} {`,
        ...type.values.map(value => renderDocumented(
            `${naming.enumMember(value.name)} = ${escapeValue(value.value)},`,
            value
        ).split('\n').map(line => `\t${line}`).join('\n')),
        '}',
    ].join('\n'), type))
    .join('\n\n')
