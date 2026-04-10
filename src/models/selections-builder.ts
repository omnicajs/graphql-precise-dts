import type { ConfigDirectivePolicies } from '../config'
import type { ConstValues } from '../lib/types'
import type { ModelContext } from './types'
import type { ResolvedSelectionDirectives } from '../directives'
import type { SelectionModel } from './types'
import type { SelectionNode } from 'graphql'
import type { TypeSelectionNode } from './selection'

import { getFragmentTypeNames } from './resolve'
import { isConditionalSelectionState } from '../directives'
import { makeFieldValue } from './value-models-builder'
import {
    makeNonNullTypeRef,
    makeTypeRefForField,
} from './resolve'
import {
    resolveSelectionDirectives,
    shouldForceNonNull,
} from '../directives'

import { Kind } from 'graphql'
import { SELECTION_MODEL_KIND } from './kinds'
import { SELECTION_STATE } from '../directives'

type ResolvedSelectionContext = {
    fieldType: TypeSelectionNode;
    isConditional: boolean;
    resolvedDirectives: ResolvedSelectionDirectives;
}

const emitDirectiveWarnings = (warnings: string[]) => warnings.forEach(message => console.warn(message))

const getSelectionDefinitionKind = (
    selection: SelectionNode
): ConstValues<typeof SELECTION_MODEL_KIND> => {
    return selection.kind === Kind.FIELD
        ? SELECTION_MODEL_KIND.FIELD
        : selection.kind === Kind.FRAGMENT_SPREAD
            ? SELECTION_MODEL_KIND.FRAGMENT_SPREAD
            : SELECTION_MODEL_KIND.INLINE_FRAGMENT
}

const resolveSelectionContext = (
    selection: SelectionNode,
    fieldType: TypeSelectionNode | undefined,
    directivePolicies: ConfigDirectivePolicies
): ResolvedSelectionContext | undefined => {
    const targetKind = getSelectionDefinitionKind(selection)
    const resolvedDirectives = resolveSelectionDirectives(
        selection.directives ? [ ...selection.directives ] : [],
        targetKind,
        directivePolicies
    )

    if (resolvedDirectives.state === SELECTION_STATE.EXCLUDED) return

    emitDirectiveWarnings(resolvedDirectives.warnings)

    if (!fieldType) return

    return {
        fieldType,
        isConditional: isConditionalSelectionState(resolvedDirectives.state),
        resolvedDirectives,
    }
}

const makeFieldSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.FIELD }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): Extract<SelectionModel, { kind: typeof SELECTION_MODEL_KIND.FIELD }> | undefined => {
    if (selectionContext.fieldType.kind !== SELECTION_MODEL_KIND.FIELD) return

    const typeRef = makeTypeRefForField(selectionContext.fieldType.currentType)

    return {
        kind: SELECTION_MODEL_KIND.FIELD,
        name: selection.name.value,
        responseName: selection.alias?.value ?? selection.name.value,
        typeRef: shouldForceNonNull(
            selection.directives ? [ ...selection.directives ] : [],
            SELECTION_MODEL_KIND.FIELD,
            context.directivePolicies
        )
            ? makeNonNullTypeRef(typeRef)
            : typeRef,
        value: makeFieldValue(
            selectionContext.fieldType,
            selection,
            context
        ),
        conditional: selectionContext.isConditional,
        overrideTypeTs: selectionContext.resolvedDirectives.overrideTypeTs,
        directives: selectionContext.resolvedDirectives.directives,
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

    return {
        kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
        name: selection.name.value,
        ...getFragmentTypeNames(spreadFragment, context.schema),
        conditional: selectionContext.isConditional,
        directives: selectionContext.resolvedDirectives.directives,
    }
}

const makeInlineFragmentSelectionModel = (
    selection: Extract<SelectionNode, { kind: Kind.INLINE_FRAGMENT }>,
    context: ModelContext,
    selectionContext: ResolvedSelectionContext
): Extract<SelectionModel, { kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT }> | undefined => {
    if (selectionContext.fieldType.kind === SELECTION_MODEL_KIND.INLINE_FRAGMENT && selectionContext.fieldType.selections) {
        return {
            kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
            ...(selection.typeCondition?.name.value && { typeCondition: selection.typeCondition.name.value }),
            selections: makeSelectionModels(
                [ ...selection.selectionSet.selections ],
                selectionContext.fieldType.selections,
                context
            ),
            conditional: selectionContext.isConditional,
            directives: selectionContext.resolvedDirectives.directives,
        }
    }
}

export const makeSelectionModel = (
    selection: SelectionNode,
    typeSelection: TypeSelectionNode | undefined,
    context: ModelContext
): SelectionModel | undefined => {
    const selectionContext = resolveSelectionContext(
        selection,
        typeSelection,
        context.directivePolicies
    )

    if (!selectionContext) return

    if (selection.kind === Kind.FIELD) {
        return makeFieldSelectionModel(selection, context, selectionContext)
    }

    if (selection.kind === Kind.FRAGMENT_SPREAD) {
        return makeFragmentSpreadSelectionModel(selection, context, selectionContext)
    }

    return makeInlineFragmentSelectionModel(selection, context, selectionContext)
}

export const makeSelectionModels = (
    selections: SelectionNode[] = [],
    typesForSelectionsNode: WeakMap<SelectionNode, TypeSelectionNode>,
    context: ModelContext
): SelectionModel[] => selections.reduce<SelectionModel[]>((selectionModels, selection) => {
    const typeSelection = typesForSelectionsNode.get(selection)
    const selectionModel = makeSelectionModel(selection, typeSelection, context)

    if (selectionModel) selectionModels.push(selectionModel)

    return selectionModels
}, [])

export const makeSelectionsForFields = (
    selections: readonly SelectionNode[] | undefined,
    selectionTypes: WeakMap<SelectionNode, TypeSelectionNode> | undefined,
    context: ModelContext
): SelectionModel[] => {
    if (!selections || !selectionTypes) return []

    return makeSelectionModels(
        [ ...selections ],
        selectionTypes,
        context
    )
}
