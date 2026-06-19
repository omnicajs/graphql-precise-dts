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
    operationVariablesTypeName(operationName: string, operationType: OperationTypeNode): string;
    operationPayloadTypeName(operationName: string, operationType: OperationTypeNode): string;
    fieldArgTypeName(typeName: string, fieldName: string): string;
    variableAliasName(typeName: string): string;
    outputAliasName(typeName: string): string;
}

const splitNameWords = (
    value: string,
    transformUnderscore: boolean
): string[] => {
    const source = transformUnderscore ? value : value.replace(/_/g, ' ')

    return source.match(/[A-Z]+[0-9]*(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z]+[0-9]*/g) ?? []
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

const hasTrailingWords = (
    value: string,
    trailingValue: string,
    transformUnderscore: boolean
): boolean => {
    const words = splitNameWords(value, transformUnderscore).map(word => word.toLowerCase())
    const trailingWords = splitNameWords(trailingValue, transformUnderscore).map(word => word.toLowerCase())

    if (!words.length || !trailingWords.length || trailingWords.length > words.length) return false

    return trailingWords.every((word, index) =>
        words[words.length - trailingWords.length + index] === word
    )
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
    const operationParts = (
        operationName: string,
        operationType: OperationTypeNode,
        ...suffixes: string[]
    ): [string, ...string[]] => [
        operationName,
        ...(
            hasTrailingWords(operationName, operationType, convention.transformUnderscore)
                ? []
                : [ operationType ]
        ),
        ...suffixes,
    ]
    const convertOperationParts = (operationName: string, ...suffixes: string[]): string => {
        if (convention.operationNames === NAMING_STYLE.KEEP) {
            return operationName + convert(suffixes.join('_'), NAMING_STYLE.PASCAL_CASE)
        }

        if (splitNameWords(operationName, convention.transformUnderscore).length > 0) {
            return convert([ operationName, ...suffixes ].join('_'), convention.operationNames)
        }

        if (convention.operationNames === NAMING_STYLE.SNAKE_CASE) {
            return [ operationName, convert(suffixes.join('_'), convention.operationNames) ].join('_')
        }

        return operationName + convert(suffixes.join('_'), NAMING_STYLE.PASCAL_CASE)
    }

    return {
        typeName: name => convert(name, convention.typeNames),
        enumValue: name => convert(name, convention.enumValues),
        operationName: name => convert(name, convention.operationNames),
        fragmentName: name => convert(name, convention.fragmentNames),
        operationTypeName(operationName, operationType) {
            return convertOperationParts(...operationParts(operationName, operationType))
        },
        operationVariablesTypeName(operationName, operationType) {
            return convertOperationParts(...operationParts(operationName, operationType, 'variables'))
        },
        operationPayloadTypeName(operationName, operationType) {
            return convertOperationParts(...operationParts(operationName, operationType, 'payload'))
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
