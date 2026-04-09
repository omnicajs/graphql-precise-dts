export const renderStringLiteralUnion = (values: string[]): string => values
    .map(value => `'${value}'`)
    .join(' | ')
