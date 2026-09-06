import type { TsType } from '@/config/ts-type'

import { indent } from '@/strings'

const precedence = (type: TsType): number => {
    if (type.kind === 'union') return 1
    if (type.kind === 'intersection') return 2

    return 3
}

const escapeLiteral = (value: string): string => value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const renderPropertyName = (value: string): string => /^[$A-Z_a-z][$\w]*$/.test(value)
    ? value
    : `'${escapeLiteral(value)}'`

const renderWithPrecedence = (type: TsType, parentPrecedence = 0): string => {
    const rendered = (() => {
        switch (type.kind) {
            case 'named':
                return type.name
            case 'null':
                return 'null'
            case 'unknown':
                return 'unknown'
            case 'array':
                return `Array<${renderWithPrecedence(type.ofType)}>`
            case 'union':
                return type.types.map(item => renderWithPrecedence(item, precedence(type)))
                    .join(' | ')
            case 'intersection':
                return type.types.map(item => renderWithPrecedence(item, precedence(type)))
                    .join(' & ')
            case 'generic':
                return `${type.name}<${type.arguments.map(item => renderWithPrecedence(item)).join(', ')}>`
            case 'object':
                return [
                    '{',
                    ...type.fields.map(field => indent(
                        `${renderPropertyName(field.name)}${field.optional ? '?' : ''}: ${
                            renderWithPrecedence(field.type)
                        };`
                    )),
                    '}',
                ].join('\n')
            case 'tuple':
                return `[${type.items.map(item => renderWithPrecedence(item)).join(', ')}]`
            case 'literal':
                return typeof type.value === 'string'
                    ? `'${escapeLiteral(type.value)}'`
                    : String(type.value)
        }
    })()

    return precedence(type) < parentPrecedence ? `(${rendered})` : rendered
}

export const renderType = (type: TsType): string => renderWithPrecedence(type)
