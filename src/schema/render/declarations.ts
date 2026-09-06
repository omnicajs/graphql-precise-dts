import type {
    ScalarMappings,
    SchemaConfig,
} from '@/config/types'
import type { NamingConvention } from '@/generation/naming'
import type { SchemaSnapshot } from '@/schema/snapshot/types'
import type {
    SchemaField,
    SchemaInputObjectType,
    SchemaInputValue,
    SchemaObjectType,
    SchemaType,
} from '@/schema/types'

import { createNamingConvention } from '@/generation/naming'
import { renderEnums } from './enums'
import { renderDocumented } from './jsdoc'
import { validateNames } from './names'
import {
    renderNonNullType,
    renderSchemaType,
} from './type'

const indent = (value: string): string => value.split('\n').map(line => `\t${line}`).join('\n')

const isRequired = (value: SchemaInputValue): boolean => value.type.kind === 'non-null'
    && value.defaultValue === undefined

const renderInputField = (
    snapshot: SchemaSnapshot,
    field: SchemaInputValue,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => renderDocumented(
    `${field.name}${isRequired(field) ? '' : '?'}: ${renderSchemaType(
        snapshot,
        field.type,
        'input',
        naming,
        scalars
    )};`,
    field
)

const renderOutputField = (
    snapshot: SchemaSnapshot,
    field: SchemaField,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => renderDocumented(
    `${field.name}${field.type.kind === 'non-null' ? '' : '?'}: ${renderSchemaType(
        snapshot,
        field.type,
        'output',
        naming,
        scalars
    )};`,
    field
)

const renderObject = (
    snapshot: SchemaSnapshot,
    type: SchemaObjectType,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => {
    const body = [
        `__typename?: '${type.id}';`,
        ...type.fields.map(field => renderOutputField(snapshot, field, naming, scalars)),
    ]
    const shape = `{\n${body.map(indent).join('\n')}\n}`

    return renderDocumented(
        `export type ${naming.typeName(type.id)} = ${[
            ...type.supertypes.map(supertype => naming.typeName(supertype)),
            shape,
        ].join(' & ')}`,
        type
    )
}

const concreteSubtypes = (
    snapshot: SchemaSnapshot,
    type: Extract<SchemaType, { kind: 'interface' }>
): ReadonlyArray<string> => [ ...new Set(type.subtypes.flatMap(subtypeId => {
    const subtype = snapshot.types.find(candidate => candidate.id === subtypeId)!

    return subtype.kind === 'object'
        ? [ subtype.id ]
        : concreteSubtypes(snapshot, subtype as Extract<SchemaType, { kind: 'interface' }>)
})) ].sort()

const renderInterface = (
    snapshot: SchemaSnapshot,
    type: Extract<SchemaType, { kind: 'interface' }>,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => {
    const typenames = concreteSubtypes(snapshot, type)
        .map(subtype => `'${subtype}'`)
        .join(' | ') || 'string'
    const body = [
        `__typename?: ${typenames};`,
        ...type.fields.map(field => renderOutputField(snapshot, field, naming, scalars)),
    ]
    const shape = `{
${body.map(indent).join('\n')}
}`

    return renderDocumented(
        `export type ${naming.typeName(type.id)} = ${[
            ...type.supertypes.map(supertype => naming.typeName(supertype)),
            shape,
        ].join(' & ')}`,
        type
    )
}

const renderOneOf = (
    snapshot: SchemaSnapshot,
    type: SchemaInputObjectType,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => type.fields.map(selected => {
    const fields = type.fields.map(field => field === selected
        ? renderDocumented(
            `${field.name}: ${renderNonNullType(snapshot, field.type, 'input', naming, scalars)};`,
            field
        )
        : `${field.name}?: never;`)

    return `{\n${fields.map(indent).join('\n')}\n}`
}).join(' | ')

const renderInputObject = (
    snapshot: SchemaSnapshot,
    type: SchemaInputObjectType,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => renderDocumented(
    `export type ${naming.typeName(type.id)} = ${type.oneOf
        ? renderOneOf(snapshot, type, naming, scalars)
        : `{\n${type.fields.map(field => indent(renderInputField(
            snapshot,
            field,
            naming,
            scalars
        ))).join('\n')}\n}`}`,
    type
)

const renderUnion = (
    type: Extract<SchemaType, { kind: 'union' }>,
    naming: NamingConvention
): string => renderDocumented(
    `export type ${naming.typeName(type.id)} = ${type.subtypes
        .map(subtype => naming.typeName(subtype))
        .join(' | ')}`,
    type
)

const renderArguments = (
    snapshot: SchemaSnapshot,
    type: SchemaObjectType | Extract<SchemaType, { kind: 'interface' }>,
    naming: NamingConvention,
    scalars: ScalarMappings
): ReadonlyArray<string> => type.fields.flatMap(field => field.arguments.length
    ? [
        `export type ${naming.typeName(`${type.id}_${field.name}_args`)} = {\n${field.arguments
            .map(argument => indent(renderInputField(snapshot, argument, naming, scalars)))
            .join('\n')}\n}`,
    ]
    : [])

const renderScalarMap = (
    snapshot: SchemaSnapshot,
    naming: NamingConvention,
    scalars: ScalarMappings
): string => {
    const entries = snapshot.types
        .filter(type => type.kind === 'scalar')
        .map(type => renderDocumented(
            `${type.id}: { input: ${renderNonNullType(
                snapshot,
                { kind: 'named', type: type.id },
                'input',
                naming,
                scalars
            )}; output: ${renderNonNullType(
                snapshot,
                { kind: 'named', type: type.id },
                'output',
                naming,
                scalars
            )}; };`,
            type
        ))

    return `export type Scalars = {\n${entries.map(indent).join('\n')}\n}`
}

export const renderSchemaDeclarations = (
    snapshot: SchemaSnapshot,
    config: SchemaConfig
): string => {
    const naming = createNamingConvention(config.naming)
    validateNames(snapshot, naming)
    const scalars = config.scalars ?? {}
    const enums = renderEnums(snapshot, naming)
    const enumNames = snapshot.types
        .filter(type => type.kind === 'enum')
        .map(type => naming.typeName(type.id))
    const enumImport = config.enumsModule && enumNames.length
        ? `import type { ${enumNames.join(', ')} } from '${config.enumsModule}'`
        : ''
    const types = snapshot.types.flatMap(type => {
        switch (type.kind) {
            case 'scalar':
            case 'enum':
                return []
            case 'object':
                return [
                    renderObject(snapshot, type, naming, scalars),
                    ...renderArguments(snapshot, type, naming, scalars),
                ]
            case 'interface':
                return [
                    renderInterface(snapshot, type, naming, scalars),
                    ...renderArguments(snapshot, type, naming, scalars),
                ]
            case 'union':
                return [ renderUnion(type, naming) ]
            case 'input-object':
                return [ renderInputObject(snapshot, type, naming, scalars) ]
        }
    })

    const blocks = [
        'export type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }',
        'export type MaybePromise<T> = T | Promise<T>',
        renderScalarMap(snapshot, naming, scalars),
    ]
    if (enumImport) blocks.unshift(enumImport)
    if (!config.enumsModule && enums) blocks.push(enums)
    blocks.push(...types)

    return `${blocks.join('\n\n')}\n`
}
