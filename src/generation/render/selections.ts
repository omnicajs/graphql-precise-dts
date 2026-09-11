import type { SchemaInput } from '../types'
import type {
    PlannedField,
    PlannedFragmentSpread,
    PlannedSelectionSet,
    PlannedTypename,
} from '../plan/types'
import type { NamingConvention } from '../naming'

import { indent } from '@/strings'
import { renderNullableType } from './syntax'

const renderFieldValue = (
    field: PlannedField,
    naming: NamingConvention,
    schema: SchemaInput
): string => {
    switch (field.value.kind) {
        case 'scalar':
            return field.value.type
        case 'enum':
            return naming.typeName(field.value.type)
        case 'composite':
            return renderComposite(field.value.selectionSet, naming, schema)
    }
}

const renderVariant = (
    types: ReadonlyArray<string>,
    fields: ReadonlyArray<PlannedField>,
    typenames: ReadonlyArray<PlannedTypename>,
    spreads: ReadonlyArray<PlannedFragmentSpread>,
    naming: NamingConvention,
    schema: SchemaInput
): string => {
    const explicitTypename = typenames.find(selection => selection.name === '__typename')
    const typename = types.some(type => schema.snapshot.types.find(candidate => candidate.id === type)?.kind === 'interface')
        ? 'string'
        : types.map(type => `'${type}'`).join(' | ')
    const properties = [
        ...(fields.some(field => field.name === '__typename') ? [] : [
            explicitTypename
                ? `__typename${explicitTypename.conditional ? '?' : ''}: ${typename};`
                : `__typename?: ${typename};`,
        ]),
        ...typenames
            .filter(selection => selection.name !== '__typename')
            .map(selection => `${selection.name}${selection.conditional ? '?' : ''}: ${selection.overrideType ?? typename};`),
        ...fields.map(field => `${field.name}${field.conditional ? '?' : ''}: ${renderNullableType(
            field.type,
            field.overrideType ?? renderFieldValue(field, naming, schema)
        )};`),
    ]
    const object = [
        '{',
        ...properties.map(property => indent(property)),
        '}',
    ].join('\n')

    return [
        object,
        ...spreads.map(spread => {
            return naming.fragmentName(spread.name)
        }),
    ].join(' & ')
}

export const renderComposite = (
    selectionSet: PlannedSelectionSet,
    naming: NamingConvention,
    schema: SchemaInput
): string => selectionSet.variants.map(variant => renderVariant(
    variant.types,
    variant.selections.filter((selection): selection is PlannedField => selection.kind === 'field'),
    variant.selections.filter((selection): selection is PlannedTypename => selection.kind === 'typename'),
    variant.selections.filter((selection): selection is PlannedFragmentSpread => selection.kind === 'fragment-spread'),
    naming,
    schema
)).join(' | ')
