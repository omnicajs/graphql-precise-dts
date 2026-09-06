import type {
    CompiledInputField,
    CompiledInputObjectValue,
    CompiledInputValue,
    CompiledVariable,
} from '../model'
import type { SchemaNonNullTypeRef } from '@/schema/types'
import type { NamingConvention } from '../naming'

import { indent } from '@/strings'
import { renderNullableType } from './syntax'

const renderInputObject = (
    value: CompiledInputObjectValue,
    naming: NamingConvention
): string => {
    if (value.oneOf) {
        return value.fields.map(selected => [
            '{',
            ...value.fields.map(field => indent(field === selected
                ? `${field.name}: ${renderRequiredInputType(field, naming)};`
                : `${field.name}?: never;`)),
            '}',
        ].join('\n')).join(' | ')
    }

    return [
        '{',
        ...value.fields.map(field => indent(
            `${field.name}${field.optional ? '?' : ''}: ${renderNullableType(field.type, renderInputValue(field.value, naming))};`
        )),
        '}',
    ].join('\n')
}

const renderRequiredInputType = (
    field: CompiledInputField,
    naming: NamingConvention
): string => {
    const type: SchemaNonNullTypeRef = {
        kind: 'non-null',
        ofType: field.type as SchemaNonNullTypeRef['ofType'],
    }

    return renderNullableType(type, renderInputValue(field.value, naming))
}

export const renderInputValue = (
    value: CompiledInputValue,
    naming: NamingConvention
): string => {
    switch (value.kind) {
        case 'scalar':
            return value.type
        case 'enum':
            return naming.typeName(value.type)
        case 'input-object':
            return renderInputObject(value, naming)
        case 'input-reference':
            return naming.typeName(value.type)
    }
}

export const renderVariables = (
    variables: ReadonlyArray<CompiledVariable>,
    naming: NamingConvention
): string => [
    '{',
    ...variables.map(variable => indent(
        `${variable.name}${variable.optional ? '?' : ''}: ${renderNullableType(
            variable.type,
            renderInputValue(variable.value, naming)
        )};`
    )),
    '}',
].join('\n')
