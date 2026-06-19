import type { EnumModel } from '../models/types'
import type { NamingConvention } from '../naming'

const assertUniqueRenderedName = (
    usedNames: Map<string, string>,
    renderedName: string,
    sourceName: string,
    subject: string
) => {
    const existingSourceName = usedNames.get(renderedName)
    if (existingSourceName && existingSourceName !== sourceName) {
        throw new Error(
            `Name collision detected in generated enum declarations: ${subject} "${existingSourceName}" and "${sourceName}" `
            + `both render as "${renderedName}". Adjust namingConvention so generated enum declaration names are unique.`
        )
    }

    usedNames.set(renderedName, sourceName)
}

const assertUniqueRenderedEnumValues = (
    enumName: string,
    enumModel: EnumModel,
    naming: NamingConvention
) => {
    const usedNames = new Map<string, string>()

    enumModel.entries.forEach(({ name }) => {
        assertUniqueRenderedName(usedNames, naming.enumValue(name), name, `enum value in "${enumName}"`)
    })
}

export const assertUniqueRenderedEnums = (
    enums: Map<string, EnumModel>,
    naming: NamingConvention
) => {
    const usedNames = new Map<string, string>()

    enums.forEach((enumModel, enumName) => {
        assertUniqueRenderedName(usedNames, naming.typeName(enumName), enumName, 'enum')
        assertUniqueRenderedEnumValues(enumName, enumModel, naming)
    })
}
