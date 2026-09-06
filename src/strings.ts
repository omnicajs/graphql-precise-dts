export const uncapitalize = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1)

export const indent = (code: string, level = 1, pad = '\t'): string => code
    .split('\n')
    .map(line => pad.repeat(level) + line)
    .join('\n')
