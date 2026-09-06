type Documented = {
    description?: string
    deprecationReason?: string
    specifiedByUrl?: string
}

const escapeCommentTerminator = (value: string): string => value.replace(/\*\//g, '*\\/')

const renderTag = (tag: string, value: string): ReadonlyArray<string> => {
    const [ first = '', ...rest ] = value.split(/\r?\n/)

    return [ `@${tag}${first ? ` ${first}` : ''}`, ...rest ]
}

export const renderJsDoc = (value: Documented): string => {
    const rows = [
        ...(value.description ? value.description.split(/\r?\n/) : []),
        ...(value.deprecationReason === undefined
            ? []
            : renderTag('deprecated', value.deprecationReason)),
        ...(value.specifiedByUrl ? renderTag('see', value.specifiedByUrl) : []),
    ].map(escapeCommentTerminator)

    if (!rows.length) return ''
    if (rows.length === 1) return `/** ${rows[0]} */`

    return [
        '/**',
        ...rows.map(row => row ? ` * ${row}` : ' *'),
        ' */',
    ].join('\n')
}

export const renderDocumented = (
    declaration: string,
    value: Documented
): string => {
    const jsdoc = renderJsDoc(value)

    return jsdoc ? `${jsdoc}\n${declaration}` : declaration
}
