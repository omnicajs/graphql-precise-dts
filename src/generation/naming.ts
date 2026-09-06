import type { OperationTypeNode } from 'graphql'
import type {
    NamingPolicy,
    NamingStyle,
} from '@/config/types'

type NormalizedNamingPolicy = {
    typeNames: NamingStyle
    operationNames: NamingStyle
    fragmentNames: NamingStyle
    enumMembers: NamingStyle
}

export type NamingConvention = {
    enumMember(name: string): string
    typeName(name: string): string
    fragmentName(name: string): string
    operationTypeName(operationName: string, operationType: OperationTypeNode): string
    operationVariablesTypeName(operationName: string, operationType: OperationTypeNode): string
    operationPayloadTypeName(operationName: string, operationType: OperationTypeNode): string
}

const splitNameWords = (value: string): ReadonlyArray<string> => value.match(
    /[A-Z]+[0-9]*(?=[A-Z][a-z])|[A-Z]?[a-z0-9]+|[A-Z]+[0-9]*/g
) ?? []

const capitalizeWord = (value: string): string => value.charAt(0).toUpperCase()
    + value.slice(1).toLowerCase()

const convertName = (
    value: string,
    style: NamingStyle
): string => {
    if (style === 'keep') return value

    const words = splitNameWords(value)
    if (!words.length) return value
    if (style === 'snakeCase') return words.map(word => word.toLowerCase()).join('_')

    const pascalName = words.map(capitalizeWord).join('')

    return style === 'pascalCase'
        ? pascalName
        : pascalName.charAt(0).toLowerCase() + pascalName.slice(1)
}

const hasTrailingWords = (
    value: string,
    trailingValue: string
): boolean => {
    const words = splitNameWords(value).map(word => word.toLowerCase())
    const trailingWords = splitNameWords(trailingValue).map(word => word.toLowerCase())

    if (!words.length || trailingWords.length > words.length) return false

    return trailingWords.every((word, index) => (
        words[words.length - trailingWords.length + index] === word
    ))
}

const normalizeNamingPolicy = (
    policy: NamingPolicy = {}
): NormalizedNamingPolicy => {
    if (typeof policy === 'string') {
        return {
            typeNames: policy,
            operationNames: policy,
            fragmentNames: policy,
            enumMembers: policy,
        }
    }

    return {
        typeNames: policy.typeNames ?? 'pascalCase',
        operationNames: policy.operationNames ?? policy.typeNames ?? 'pascalCase',
        fragmentNames: policy.fragmentNames ?? policy.typeNames ?? 'pascalCase',
        enumMembers: policy.enumMembers ?? 'keep',
    }
}

export const createNamingConvention = (
    policy?: NamingPolicy
): NamingConvention => {
    const naming = normalizeNamingPolicy(policy)
    const operationParts = (
        operationName: string,
        operationType: OperationTypeNode,
        ...suffixes: string[]
    ): [string, ...string[]] => [
        operationName,
        ...(hasTrailingWords(operationName, operationType) ? [] : [ operationType ]),
        ...suffixes,
    ]
    const convertOperationParts = (
        operationName: string,
        ...suffixes: string[]
    ): string => {
        if (naming.operationNames === 'keep') {
            return operationName + convertName(suffixes.join('_'), 'pascalCase')
        }

        if (splitNameWords(operationName).length) {
            return convertName([ operationName, ...suffixes ].join('_'), naming.operationNames)
        }

        return naming.operationNames === 'snakeCase'
            ? `${operationName}_${convertName(suffixes.join('_'), naming.operationNames)}`
            : operationName + convertName(suffixes.join('_'), 'pascalCase')
    }

    return {
        enumMember: name => convertName(name, naming.enumMembers),
        typeName: name => convertName(name, naming.typeNames),
        fragmentName: name => convertName(name, naming.fragmentNames),
        operationTypeName: (operationName, operationType) => convertOperationParts(
            ...operationParts(operationName, operationType)
        ),
        operationVariablesTypeName: (operationName, operationType) => convertOperationParts(
            ...operationParts(operationName, operationType, 'variables')
        ),
        operationPayloadTypeName: (operationName, operationType) => convertOperationParts(
            ...operationParts(operationName, operationType, 'payload')
        ),
    }
}
