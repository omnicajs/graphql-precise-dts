import type {
    FieldNode,
    FragmentSpreadNode,
    InlineFragmentNode,
    SelectionSetNode,
} from 'graphql'
import type { TypeId } from '@/schema/types'
import type { SchemaTypeRef } from '@/schema/types'
import type { CompilationContext } from './context'
import type {
    CompiledField,
    CompiledFragmentSpread,
    CompiledInlineFragment,
    CompiledSelection,
    CompiledTypename,
} from './model'
import type { VariableScope } from './variables'

import {
    makeArgumentsSignature,
    validateArguments,
} from './arguments'
import {
    getSelectionTypes,
    overlap,
} from './composites'
import { compileSelectionState } from './directives'
import {
    invalidDocument,
    unsupportedSchemaType,
} from './errors'
import { resolveFragment } from './fragments'
import { getNamedType } from '@/schema/ref'
import { getSourceLocation } from './diagnostics/location'
import {
    getScalarType,
    hasScalarMapping,
} from './scalars'
import { Kind } from 'graphql'
import { compileEnumValue } from './enums'
const compileTypename = (
    field: FieldNode,
    parent: Pick<CompiledField, 'parentType' | 'parentIsObject'>,
    included: boolean,
    conditional: boolean,
    forceNonNull: boolean,
    overrideType?: string
): CompiledTypename => {
    if (field.arguments?.length) return invalidDocument('Field "__typename" does not define arguments', field)
    if (field.selectionSet) return invalidDocument('Field "__typename" cannot have selections', field)

    return {
        kind: 'typename',
        ...parent,
        included,
        name: field.alias?.value ?? field.name.value,
        field: '__typename',
        argumentsSignature: '',
        conditional,
        forceNonNull,
        overrideType,
        location: getSourceLocation(field),
    }
}

const compileFragmentSpread = (
    spread: FragmentSpreadNode,
    parentType: TypeId,
    included: boolean,
    conditional: boolean,
    context: CompilationContext
): CompiledFragmentSpread => {
    const name = spread.name.value
    const fragment = resolveFragment(
        context.fragments,
        name,
        context.sourcePath,
        context.sources.get(context.sourcePath)!.imports,
        spread
    )
    const fragmentType = fragment.definition.typeCondition.name.value
    const parentPossibleTypes = getSelectionTypes(parentType, context.schema, spread)
    const fragmentPossibleTypes = getSelectionTypes(fragmentType, context.schema, spread)

    if (!overlap(parentPossibleTypes, fragmentPossibleTypes)) {
        return invalidDocument(`Fragment "${name}" cannot apply to type "${parentType}"`, spread)
    }

    return {
        kind: 'fragment-spread',
        included,
        name,
        sourceId: fragment.sourceId,
        sourcePath: fragment.sourcePath,
        possibleTypes: fragmentPossibleTypes,
        conditional,
        location: getSourceLocation(spread),
    }
}

const compileInlineFragment = (
    fragment: InlineFragmentNode,
    parentType: TypeId,
    included: boolean,
    conditional: boolean,
    variables: VariableScope,
    context: CompilationContext
): CompiledInlineFragment => {
    const type = fragment.typeCondition?.name.value ?? parentType
    const parentPossibleTypes = getSelectionTypes(parentType, context.schema, fragment)
    const possibleTypes = getSelectionTypes(type, context.schema, fragment)

    if (!overlap(parentPossibleTypes, possibleTypes)) {
        return invalidDocument(`Inline fragment on "${type}" cannot apply to type "${parentType}"`, fragment)
    }

    return {
        kind: 'inline-fragment',
        included,
        type,
        possibleTypes,
        selections: compileSelectionSet(fragment.selectionSet, type, variables, context),
        conditional,
        location: getSourceLocation(fragment),
    }
}

const compileField = (
    field: FieldNode,
    parentType: TypeId,
    included: boolean,
    conditional: boolean,
    forceNonNull: boolean,
    overrideType: string | undefined,
    variables: VariableScope,
    context: CompilationContext
): CompiledField | CompiledTypename => {
    const parent = {
        parentType,
        parentIsObject: context.schema.getType(parentType).kind === 'object',
    }
    if (field.name.value === '__typename') {
        return compileTypename(field, parent, included, conditional, forceNonNull, overrideType)
    }

    const schemaField = context.schema.getField(parentType, field.name.value)
    if (!schemaField) return invalidDocument(`Type "${parentType}" does not define field "${field.name.value}"`, field)
    validateArguments(field, schemaField, variables, context)

    const name = field.alias?.value ?? field.name.value
    const argumentsSignature = makeArgumentsSignature(field.arguments!)
    const type: SchemaTypeRef = forceNonNull && schemaField.type.kind !== 'non-null'
        ? { kind: 'non-null', ofType: schemaField.type }
        : schemaField.type
    const namedType = getNamedType(type)
    const schemaType = context.schema.getOutputType(namedType)

    if (schemaType.kind === 'scalar') {
        if (field.selectionSet) return invalidDocument(`Scalar field "${parentType}.${name}" cannot have selections`, field)

        const scalarType = getScalarType(schemaType.id, context.scalars, 'output')
        if (!scalarType) {
            return unsupportedSchemaType(hasScalarMapping(context.scalars, schemaType.id)
                ? `Scalar "${schemaType.id}" does not define an output mapping`
                : `Scalar "${schemaType.id}" is not supported yet`, field)
        }

        return {
            kind: 'field',
            ...parent,
            included,
            name,
            field: field.name.value,
            argumentsSignature,
            type,
            conditional,
            forceNonNull,
            overrideType,
            location: getSourceLocation(field),
            value: {
                kind: 'scalar',
                type: scalarType,
            },
        }
    }

    if (schemaType.kind === 'enum') {
        if (field.selectionSet) return invalidDocument(`Enum field "${parentType}.${name}" cannot have selections`, field)

        return {
            kind: 'field',
            ...parent,
            included,
            name,
            field: field.name.value,
            argumentsSignature,
            type,
            conditional,
            forceNonNull,
            overrideType,
            location: getSourceLocation(field),
            value: compileEnumValue(schemaType),
        }
    }

    if (!field.selectionSet) return invalidDocument(`Composite field "${parentType}.${name}" must have selections`, field)

    return {
        kind: 'field',
        ...parent,
        included,
        name,
        field: field.name.value,
        argumentsSignature,
        type,
        conditional,
        forceNonNull,
        overrideType,
        location: getSourceLocation(field),
        value: {
            kind: 'composite',
            type: schemaType.id,
            possibleTypes: getSelectionTypes(schemaType.id, context.schema, field),
            selections: compileSelectionSet(field.selectionSet, schemaType.id, variables, context),
        },
    }
}

export const compileSelectionSet = (
    selectionSet: SelectionSetNode,
    parentType: TypeId,
    variables: VariableScope,
    context: CompilationContext
): ReadonlyArray<CompiledSelection> => {
    const selections: CompiledSelection[] = []

    for (const selection of selectionSet.selections) {
        const state = compileSelectionState(selection, context, variables)
        const directive = selection.directives!.find(directive => (
            directive.name.value === 'skip' || directive.name.value === 'include'
        ))
        const conditionalDirective = directive ? getSourceLocation(directive) : undefined

        if (selection.kind === Kind.FRAGMENT_SPREAD) {
            selections.push({ ...compileFragmentSpread(
                selection,
                parentType,
                state.included,
                state.conditional,
                context
            ), conditionalDirective })
            continue
        }
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            const compiled = compileInlineFragment(
                selection,
                parentType,
                state.included,
                state.conditional,
                variables,
                context
            )
            selections.push({ ...compiled, conditionalDirective })
            continue
        }

        const compiled = compileField(
            selection,
            parentType,
            state.included,
            state.conditional,
            state.forceNonNull,
            state.overrideType,
            variables,
            context
        )
        selections.push({ ...compiled, conditionalDirective })
    }

    if (context.typename !== 'abstract' || selections.some(selection => selection.kind === 'typename' || (selection.kind === 'field' && selection.name === '__typename'))) return selections
    const type = context.schema.getType(parentType)
    if (type.kind !== 'interface' && type.kind !== 'union') return selections
    const possibleTypes = getSelectionTypes(parentType, context.schema, selectionSet)
    if (!possibleTypes.some(type => context.schema.getType(type).kind === 'object')) return selections

    // Keep the client-backed selection in IR so fragment expansion preserves its presence.
    selections.unshift({
        kind: 'typename',
        parentType,
        parentIsObject: false,
        implicit: true,
        included: true,
        name: '__typename',
        field: '__typename',
        argumentsSignature: '',
        conditional: false,
        forceNonNull: false,
        location: getSourceLocation(selectionSet),
    })
    return selections
}
