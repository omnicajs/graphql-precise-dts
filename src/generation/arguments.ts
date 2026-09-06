import type {
    ASTNode,
    ArgumentNode,
    FieldNode,
    ValueNode,
} from 'graphql'
import type {
    SchemaField,
    SchemaInputValue,
} from '@/schema/types'
import type { CompilationContext } from './context'
import type { VariableScope } from './variables'
import type {
    ValueLocation,
    VariableValueValidator,
} from './values'

import { getSourceLocation } from './diagnostics/location'
import { invalidDocument } from './errors'
import {
    Kind,
    print,
} from 'graphql'
import { validateValue } from './values'

const normalizeArgumentValue = (value: ValueNode): ValueNode => {
    if (value.kind === Kind.LIST) {
        return {
            ...value,
            values: value.values.map(normalizeArgumentValue),
        }
    }
    if (value.kind === Kind.OBJECT) {
        return {
            ...value,
            fields: [ ...value.fields ]
                .sort((left, right) => left.name.value.localeCompare(right.name.value))
                .map(field => ({
                    ...field,
                    value: normalizeArgumentValue(field.value),
                })),
        }
    }

    return value
}

export const makeArgumentsSignature = (
    provided: ReadonlyArray<ArgumentNode>
): string => [ ...provided ]
    .sort((left, right) => left.name.value.localeCompare(right.name.value))
    .map(argument => `${argument.name.value}:${print(normalizeArgumentValue(argument.value))}`)
    .join(',')

export const validateInputArguments = (
    provided: ReadonlyArray<ArgumentNode>,
    expected: ReadonlyArray<SchemaInputValue>,
    variables: VariableScope,
    context: CompilationContext,
    subject: string,
    subjectNode: ASTNode
): void => {
    const providedArguments = new Set<string>()

    for (const argument of provided) {
        const argumentName = argument.name.value
        if (providedArguments.has(argumentName)) {
            invalidDocument(`Argument "${argumentName}" is provided more than once`, argument)
        }

        providedArguments.add(argumentName)

        const schemaArgument = expected.find(candidate => candidate.name === argumentName)
        if (!schemaArgument) return invalidDocument(`${subject} does not define argument "${argumentName}"`, argument)

        const validateVariable: VariableValueValidator = (
            node,
            location: ValueLocation,
            _variableSubject,
            requiresNonNullType
        ) => {
            const variableName = node.name.value
            variables.usages.push({
                name: variableName,
                location,
                argumentName,
                requiresNonNullType,
                sourceLocation: getSourceLocation(node),
            })
        }

        validateValue(
            argument.value,
            schemaArgument,
            context.schema,
            `${subject} argument "${argumentName}"`,
            validateVariable
        )
    }

    for (const schemaArgument of expected) {
        const required = schemaArgument.type.kind === 'non-null' && schemaArgument.defaultValue === undefined
        if (required && !providedArguments.has(schemaArgument.name)) {
            invalidDocument(`Required argument "${schemaArgument.name}" is missing`, subjectNode)
        }
    }
}

export const validateArguments = (
    field: FieldNode,
    schemaField: SchemaField,
    variables: VariableScope,
    context: CompilationContext
): void => validateInputArguments(
    field.arguments!,
    schemaField.arguments,
    variables,
    context,
    `Field "${field.name.value}"`,
    field
)
