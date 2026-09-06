import type {
    ValueNode,
    VariableNode,
} from 'graphql'
import type {
    SchemaInputValue,
    SchemaTypeRef,
} from '@/schema/types'
import type { SchemaView } from '@/schema/view'

import { invalidDocument } from './errors'
import { Kind } from 'graphql'

export type ValueLocation = Pick<SchemaInputValue, 'defaultValue' | 'type'>

export type VariableValueValidator = (
    variable: VariableNode,
    location: ValueLocation,
    subject: string,
    requiresNonNullType: boolean
) => void

const renderType = (type: SchemaTypeRef): string => {
    if (type.kind === 'named') return type.type
    if (type.kind === 'list') return `[${renderType(type.ofType)}]`

    return `${renderType(type.ofType)}!`
}

const invalidLiteral = (subject: string, type: SchemaTypeRef, value: ValueNode): never => invalidDocument(
    `${subject} is not a valid literal for input type "${renderType(type)}"`,
    value
)

const validateScalar = (
    value: ValueNode,
    scalar: string,
    type: SchemaTypeRef,
    subject: string
): void => {
    const valid = (() => {
        switch (scalar) {
            case 'Boolean':
                return value.kind === Kind.BOOLEAN
            case 'Float':
                return (value.kind === Kind.FLOAT || value.kind === Kind.INT)
                    && Number.isFinite(Number(value.value))
            case 'ID':
                return value.kind === Kind.STRING || value.kind === Kind.INT
            case 'Int':
                return value.kind === Kind.INT
                    && Number(value.value) >= -2147483648
                    && Number(value.value) <= 2147483647
            case 'String':
                return value.kind === Kind.STRING
            default:
                return true
        }
    })()

    if (!valid) invalidLiteral(subject, type, value)
}

const validateInputObject = (
    value: ValueNode,
    fields: ReadonlyArray<SchemaInputValue>,
    oneOf: boolean,
    schema: SchemaView,
    type: SchemaTypeRef,
    subject: string,
    validateVariable?: VariableValueValidator
): void => {
    if (value.kind !== Kind.OBJECT) return invalidLiteral(subject, type, value)

    const provided = new Map<string, ValueNode>()

    for (const field of value.fields) {
        const name = field.name.value
        if (provided.has(name)) invalidDocument(`${subject} provides input field "${name}" more than once`, field)

        const schemaField = fields.find(candidate => candidate.name === name)
        if (!schemaField) {
            return invalidDocument(`${subject} provides unknown input field "${name}"`, field)
        }

        provided.set(name, field.value)
        validateValue(
            field.value,
            schemaField,
            schema,
            `${subject}.${name}`,
            validateVariable,
            oneOf
        )
    }

    for (const field of fields) {
        const required = field.type.kind === 'non-null' && field.defaultValue === undefined
        if (required && !provided.has(field.name)) {
            invalidDocument(`${subject} is missing required input field "${field.name}"`, value)
        }
    }

    if (oneOf) {
        const values = [ ...provided.values() ]
        if (values.length !== 1 || values[0]?.kind === Kind.NULL) {
            invalidDocument(`${subject} must provide exactly one non-null field`, value)
        }
    }
}

export const validateValue = (
    value: ValueNode,
    location: ValueLocation,
    schema: SchemaView,
    subject: string,
    validateVariable?: VariableValueValidator,
    requiresNonNullVariable = false
): void => {
    const { type } = location

    if (value.kind === Kind.VARIABLE) {
        validateVariable!(value, location, subject, requiresNonNullVariable)
        return
    }

    if (type.kind === 'non-null') {
        if (value.kind === Kind.NULL) return invalidLiteral(subject, type, value)

        validateValue(value, { type: type.ofType }, schema, subject, validateVariable)
        return
    }

    if (value.kind === Kind.NULL) return

    if (type.kind === 'list') {
        const values = value.kind === Kind.LIST ? value.values : [ value ]
        values.forEach((item, index) => validateValue(
            item,
            { type: type.ofType },
            schema,
            `${subject}[${index}]`,
            validateVariable
        ))
        return
    }

    const schemaType = schema.getInputType(type.type)

    if (schemaType.kind === 'scalar') {
        validateScalar(value, schemaType.id, type, subject)
        return
    }

    if (schemaType.kind === 'enum') {
        if (value.kind !== Kind.ENUM || !schemaType.values.some(candidate => candidate.name === value.value)) {
            return invalidLiteral(subject, type, value)
        }
        return
    }

    validateInputObject(
        value,
        schemaType.fields,
        schemaType.oneOf,
        schema,
        type,
        subject,
        validateVariable
    )
}
