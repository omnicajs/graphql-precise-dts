import type { ModelContext } from './types'
import type { ResolvedStructuralDirectives } from '../directives/types'
import type { SelectionModel } from './types'
import type { SelectionNode } from 'graphql'
import type { StructuralDirectivePolicies } from '../directives/types'
import type { TypeSelectionNode } from './selection'

import { formatNodeLocation } from '../lib/documents'
import { getFragmentTypeNames } from './resolve'
import { isConditionalSelectionState } from '../directives/resolve'
import { makeFieldValue } from './value-models-builder'
import {
    makeNonNullTypeRef,
    makeTypeRefForField,
} from './resolve'
import { resolveStructuralSelectionDirectivesForNode } from '../directives/resolve'
import { print } from 'graphql'

import { Kind } from 'graphql'
import { SELECTION_MODEL_KIND } from '../kinds'
import { SELECTION_STATE } from '../directives/kinds'

type ResolvedSelectionContext = {
    fieldType: TypeSelectionNode;
    resolvedDirectives: ResolvedStructuralDirectives;
}

const resolveSelectionContext = (
    selection: SelectionNode,
    fieldType: TypeSelectionNode | undefined,
    directivePolicies: StructuralDirectivePolicies
): ResolvedSelectionContext | undefined => {
    const resolvedDirectives = resolveStructuralSelectionDirectivesForNode(
        selection,
        directivePolicies
    )

    if (resolvedDirectives.state === SELECTION_STATE.EXCLUDED) return

    if (!fieldType) return

    return {
        fieldType,
        resolvedDirectives,
    }
}

const makeFieldSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FIELD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext,
    diagnosticOwner: string
): Extract<SelectionModel, { kind: typeof SELECTION_MODEL_KIND.FIELD }> | undefined => {
    if (selectionContext.fieldType.kind !== SELECTION_MODEL_KIND.FIELD) return

    if (selection.alias?.value === '__typename' && selection.name.value !== '__typename') {
        throw new Error('Aliasing a field to "__typename" is not supported because this name is reserved')
    }

    const typeRef = makeTypeRefForField(selectionContext.fieldType.currentType)
    const directiveNames = selection.directives?.map(directive => directive.name.value) ?? []

    return {
        kind: SELECTION_MODEL_KIND.FIELD,
        name: selection.name.value,
        responseName: selection.alias?.value ?? selection.name.value,
        argumentsSignature: selection.arguments
            ? selection.arguments.map(argument => print(argument)).sort().join(',')
            : '',
        diagnosticLocation: formatNodeLocation(selection, context.documentLocations),
        typeRef: selectionContext.resolvedDirectives.forceNonNull
            ? makeNonNullTypeRef(typeRef)
            : typeRef,
        value: makeFieldValue(
            selectionContext.fieldType,
            selection,
            context,
            diagnosticOwner
        ),
        conditional: isConditionalSelectionState(selectionContext.resolvedDirectives.state),
        directives: selectionContext.resolvedDirectives.directives,
        ...(directiveNames.length ? { directiveNames } : {}),
    }
}

const makeFragmentSpreadSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FRAGMENT_SPREAD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): Extract<SelectionModel, { kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD }> | undefined => {
    if (selectionContext.fieldType.kind !== SELECTION_MODEL_KIND.FRAGMENT_SPREAD) return

    const spreadFragment = context.fragmentDefinitions.get(selection.name.value)
    if (!spreadFragment) return
    const directiveNames = selection.directives?.map(directive => directive.name.value) ?? []

    return {
        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
        name: selection.name.value,
        diagnosticLocation: formatNodeLocation(selection, context.documentLocations),
        ...getFragmentTypeNames(spreadFragment, context.schema),
        conditional: isConditionalSelectionState(selectionContext.resolvedDirectives.state),
        directives: selectionContext.resolvedDirectives.directives,
        ...(directiveNames.length ? { directiveNames } : {}),
    }
}

const makeInlineFragmentSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.INLINE_FRAGMENT }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext,
    diagnosticOwner: string
): Extract<SelectionModel, { kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT }> | undefined => {
    if (selectionContext.fieldType.kind === SELECTION_MODEL_KIND.INLINE_FRAGMENT && selectionContext.fieldType.selections) {
        const directiveNames = selection.directives?.map(directive => directive.name.value) ?? []
        return {
            kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
            diagnosticLocation: formatNodeLocation(selection, context.documentLocations),
            ...(selection.typeCondition?.name.value && { typeCondition: selection.typeCondition.name.value }),
            selections: makeSelectionModels(
                [ ...selection.selectionSet.selections ],
                selectionContext.fieldType.selections,
                context,
                diagnosticOwner
            ),
            conditional: isConditionalSelectionState(selectionContext.resolvedDirectives.state),
            directives: selectionContext.resolvedDirectives.directives,
            ...(directiveNames.length ? { directiveNames } : {}),
        }
    }
}

export const makeSelectionModel = (
    selection: SelectionNode,
    typeSelection: TypeSelectionNode | undefined,
    context: ModelContext,
    diagnosticOwner = 'selection set'
): SelectionModel | undefined => {
    const selectionContext = resolveSelectionContext(
        selection,
        typeSelection,
        context.structuralDirectivePolicies
    )

    if (!selectionContext) return

    if (selection.kind === Kind.FIELD) {
        return makeFieldSelectionModel(selection, context, selectionContext, diagnosticOwner)
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
        return makeFragmentSpreadSelectionModel(selection, context, selectionContext)
    }

    return makeInlineFragmentSelectionModel(selection, context, selectionContext, diagnosticOwner)
}

export const makeSelectionModels = (
    selections: SelectionNode[] = [],
    typesForSelectionsNode: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext,
    diagnosticOwner = 'selection set'
): SelectionModel[] => selections.reduce<SelectionModel[]>((result, selection) => {
    const typeSelection = typesForSelectionsNode.get(selection)
    const selectionModel = makeSelectionModel(selection, typeSelection, context, diagnosticOwner)

    if (selectionModel) result.push(selectionModel)

    return result
}, [])

export const makeSelectionsForFields = (
    selections: readonly SelectionNode[] | undefined,
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    context: ModelContext,
    diagnosticOwner = 'selection set'
): SelectionModel[] => {
    if (!selections || !selectionTypes) return []

    return makeSelectionModels(
        [ ...selections ],
        selectionTypes,
        context,
        diagnosticOwner
    )
}
