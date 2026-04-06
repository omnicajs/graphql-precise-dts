export const indent = (code: string, level = 1, pad = '\t') => code
    .split('\n')
    .map(line => pad.repeat(level) + line)
    .join('\n')

export const renderStringLiteralUnion = (values: string[]): string => values
    .map(value => `'${value}'`)
    .join(' | ')
