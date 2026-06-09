export type JsDoc = {
    description?: string;
    deprecationReason?: string;
    remarks?: string | string[];
    see?: string | string[];
}

const sanitizeJsDocLine = (line: string): string => line.replace(/\*\//g, '*\\/')

const toArray = <TValue>(value: TValue | TValue[] | undefined): TValue[] => {
    if (!value) return []
    return Array.isArray(value) ? value : [ value ]
}

export const renderJsDoc = (
    { description, deprecationReason, remarks, see }: JsDoc,
    indent = ''
): string => {
    const remarkRows = toArray<string>(remarks)
    const seeRows = toArray<string>(see)

    const rows = [
        ...(description?.split(/\r?\n/) ?? []),
        ...(deprecationReason ? [ `@deprecated ${deprecationReason}` ] : []),
        ...remarkRows.map(value => `@remarks ${value}`),
        ...seeRows.map(value => `@see ${value}`),
    ]

    if (!rows.length) return ''

    if (rows.length === 1) return `${indent}/** ${sanitizeJsDocLine(rows[0])} */`

    return [
        `${indent}/**`,
        ...rows.map(row => `${indent} * ${sanitizeJsDocLine(row)}`),
        `${indent} */`,
    ].join('\n')
}
