import type { NamingConvention } from '../naming'
import type { SchemaOutputModel } from '../models/generation'

const assertUniqueRenderedSchemaName = (
    usedNames: Map<string, string>,
    renderedName: string,
    sourceName: string
) => {
    const existingSourceName = usedNames.get(renderedName)
    if (existingSourceName && existingSourceName !== sourceName) {
        throw new Error(
            `Name collision detected in generated schema declarations: "${existingSourceName}" and "${sourceName}" `
            + `both render as "${renderedName}". Adjust namingConvention so generated schema declaration names are unique.`
        )
    }

    usedNames.set(renderedName, sourceName)
}

export const assertUniqueRenderedSchemaNames = (
    schema: SchemaOutputModel,
    naming: NamingConvention
) => {
    const usedNames = new Map<string, string>();

    [
        ...schema.enumReferences,
        ...schema.inputTypes.keys(),
        ...schema.interfaceTypes.keys(),
        ...schema.objectTypes.keys(),
        ...schema.unionTypes.keys(),
    ].forEach(sourceName => {
        assertUniqueRenderedSchemaName(usedNames, naming.typeName(sourceName), sourceName)
    })

    schema.fieldArgTypes.forEach(({ parentTypeName, fieldName }) => {
        assertUniqueRenderedSchemaName(
            usedNames,
            naming.fieldArgTypeName(parentTypeName, fieldName),
            `${parentTypeName}.${fieldName} arguments`
        )
    })
}
