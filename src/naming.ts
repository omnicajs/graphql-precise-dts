import type {
    ConfigNamingConvention,
    NAMING_STYLE as NamingStyleConfig,
} from './config'
import type { OperationTypeNode } from 'graphql'

import { NAMING_STYLE } from './config'

const DEFAULT_TYPE_NAME_STYLE = NAMING_STYLE.PASCAL_CASE

type NormalizedNamingConvention = {
    typeNames: NamingStyleConfig;
    enumValues: NamingStyleConfig;
    operationNames: NamingStyleConfig;
    fragmentNames: NamingStyleConfig;
    transformUnderscore: boolean;
}

export type NamingConvention = {
    typeName(name: string): string;
    enumValue(name: string): string;
    operationName(name: string): string;
    fragmentName(name: string): string;
    operationTypeName(operationName: string, operationType: OperationTypeNode): string;
    fieldArgTypeName(typeName: string, fieldName: string): string;
    variableAliasName(typeName: string): string;
    outputAliasName(typeName: string): string;
}

const splitNameWords = (
    value: string,
    transformUnderscore: boolean
): string[] => {
    const source = transformUnderscore ? value : value.replace(/_/g, ' ')

    return source
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
}

const capitalizeWord = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

const convertName = (
    value: string,
    style: NamingStyleConfig,
    transformUnderscore: boolean
): string => {
    if (style === NAMING_STYLE.KEEP) return value

    const words = splitNameWords(value, transformUnderscore)
    if (!words.length) return value

    if (style === NAMING_STYLE.SNAKE_CASE) return words.map(word => word.toLowerCase()).join('_')

    const pascalName = words.map(capitalizeWord).join('')
    if (style === NAMING_STYLE.PASCAL_CASE) return pascalName

    return pascalName.charAt(0).toLowerCase() + pascalName.slice(1)
}

const normalizeNamingConvention = (
    namingConvention: ConfigNamingConvention = {}
): NormalizedNamingConvention => {
    if (typeof namingConvention === 'string') {
        return {
            typeNames: namingConvention,
            enumValues: namingConvention,
            operationNames: namingConvention,
            fragmentNames: namingConvention,
            transformUnderscore: true,
        }
    }

    return {
        typeNames: namingConvention.typeNames ?? DEFAULT_TYPE_NAME_STYLE,
        enumValues: namingConvention.enumValues ?? DEFAULT_TYPE_NAME_STYLE,
        operationNames: namingConvention.operationNames ?? namingConvention.typeNames ?? DEFAULT_TYPE_NAME_STYLE,
        fragmentNames: namingConvention.fragmentNames ?? namingConvention.typeNames ?? DEFAULT_TYPE_NAME_STYLE,
        transformUnderscore: namingConvention.transformUnderscore ?? true,
    }
}

export const createNamingConvention = (
    config?: ConfigNamingConvention
): NamingConvention => {
    const convention = normalizeNamingConvention(config)
    const convert = (value: string, style: NamingStyleConfig) => convertName(value, style, convention.transformUnderscore)

    return {
        typeName: name => convert(name, convention.typeNames),
        enumValue: name => convert(name, convention.enumValues),
        operationName: name => convert(name, convention.operationNames),
        fragmentName: name => convert(name, convention.fragmentNames),
        operationTypeName(operationName, operationType) {
            return `${convert(operationName, convention.operationNames)}${convert(operationType, convention.typeNames)}`
        },
        fieldArgTypeName(typeName, fieldName) {
            if (convention.typeNames === NAMING_STYLE.KEEP) return `${typeName}${fieldName}Args`

            const name = `${typeName}_${fieldName}`
            return convert(`${name}_Args`, convention.typeNames)
        },
        variableAliasName(typeName) {
            const inputName = typeName.endsWith('Input') ? typeName : `${typeName}Input`
            return convert(`${convert(inputName, convention.typeNames)}Alias`, convention.typeNames)
        },
        outputAliasName(typeName) {
            return convert(`${convert(typeName, convention.typeNames)}Alias`, convention.typeNames)
        },
    }
}
