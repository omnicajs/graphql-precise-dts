import type {
    ConditionalSelectionState,
    GenerationDirectivePolicies,
    GenerationDirectivePolicy,
    ResolvedGenerationDirectives,
    ResolvedStructuralDirectives,
    StructuralDirectivePolicies,
    StructuralDirectivePolicy,
} from './types'

import type { ConstValues } from '../lib/types'

import type {
    DirectiveNode,
    SelectionNode,
    ValueNode,
} from 'graphql'

import {
    CONDITIONAL_DIRECTIVE,
    DIRECTIVE_POLICY_EFFECT,
} from './kinds'
import { Kind } from 'graphql'
import { SELECTION_MODEL_KIND } from '../kinds'
import { SELECTION_STATE } from './kinds'

const conditionalDirectives: ReadonlySet<string> = new Set(Object.values(CONDITIONAL_DIRECTIVE))

export const isConditionalSelectionState = (
    state: ConditionalSelectionState
): boolean => state === SELECTION_STATE.CONDITIONAL

const getBooleanLiteral = (valueNode?: ValueNode): boolean | undefined => {
    if (!valueNode || valueNode.kind !== Kind.BOOLEAN) return

    return valueNode.value
}

const getDirectiveIfValue = (directive: DirectiveNode): boolean | undefined => {
    const ifArg = directive.arguments?.find(arg => arg.name.value === 'if')

    return getBooleanLiteral(ifArg?.value)
}

const getStructuralDirectivePolicy = (
    directiveName: string,
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: StructuralDirectivePolicies = {}
): StructuralDirectivePolicy | undefined => {
    const policy = directivePolicies[directiveName]
    if (!policy) return

    return policy[targetKind]
}

const getGenerationDirectivePolicy = (
    directiveName: string,
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: GenerationDirectivePolicies = {}
): GenerationDirectivePolicy | undefined => {
    const policy = directivePolicies[directiveName]
    if (!policy) return

    return policy[targetKind]
}

const markSelectionConditional = (
    resolved: ResolvedStructuralDirectives,
    directiveName: string
) => {
    resolved.state = SELECTION_STATE.CONDITIONAL
    resolved.directives.push(directiveName)
}

const resolveConditionalDirective = (
    directive: DirectiveNode,
    resolved: ResolvedStructuralDirectives
): ConditionalSelectionState | undefined => {
    if (!conditionalDirectives.has(directive.name.value)) return

    const ifValue = getDirectiveIfValue(directive)

    if (directive.name.value === CONDITIONAL_DIRECTIVE.SKIP) {
        if (ifValue === true) return SELECTION_STATE.EXCLUDED
        if (ifValue === undefined) markSelectionConditional(resolved, directive.name.value)

        return
    } else if (directive.name.value === CONDITIONAL_DIRECTIVE.INCLUDE) {
        if (ifValue === false) return SELECTION_STATE.EXCLUDED
        if (ifValue === undefined) markSelectionConditional(resolved, directive.name.value)
    }
}

const applyStructuralDirectivePolicy = (
    directive: DirectiveNode,
    policy: StructuralDirectivePolicy,
    resolved: ResolvedStructuralDirectives
): ConditionalSelectionState | undefined => {
    switch (policy.effect) {
        case DIRECTIVE_POLICY_EFFECT.IGNORE:
            return
        case DIRECTIVE_POLICY_EFFECT.NONNULL:
            resolved.forceNonNull = true
            return
        case DIRECTIVE_POLICY_EFFECT.EXCLUDE:
            return SELECTION_STATE.EXCLUDED
        case DIRECTIVE_POLICY_EFFECT.CONDITIONAL:
            markSelectionConditional(resolved, directive.name.value)
            return
        default:
            return
    }
}

const applyGenerationDirectivePolicy = (
    directiveName: string,
    policy: GenerationDirectivePolicy,
    resolved: ResolvedGenerationDirectives
) => {
    switch (policy.effect) {
        case DIRECTIVE_POLICY_EFFECT.OVERRIDE_TYPE:
            resolved.overrideType = policy.type
            resolved.directives.push(directiveName)
            return
        case DIRECTIVE_POLICY_EFFECT.WARN:
            resolved.directives.push(directiveName)
            resolved.warnings.push(policy.message ?? `Directive "@${directiveName}" requires manual review`)
            return
        default:
            return
    }
}

export const resolveStructuralSelectionDirectives = (
    directives: DirectiveNode[] = [],
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: StructuralDirectivePolicies = {}
): ResolvedStructuralDirectives => {
    const resolved = {
        directives: [],
        forceNonNull: false,
        state: SELECTION_STATE.INCLUDED,
    } satisfies ResolvedStructuralDirectives

    for (const directive of directives) {
        const conditionalState = resolveConditionalDirective(directive, resolved)
        if (conditionalState === SELECTION_STATE.EXCLUDED) return { ...resolved, state: SELECTION_STATE.EXCLUDED }
        if (conditionalState) continue

        const policy = getStructuralDirectivePolicy(directive.name.value, targetKind, directivePolicies)
        if (!policy) continue

        const policyState = applyStructuralDirectivePolicy(directive, policy, resolved)
        if (policyState === SELECTION_STATE.EXCLUDED) return { ...resolved, state: SELECTION_STATE.EXCLUDED }
    }

    return resolved
}

export const resolveGenerationSelectionDirectives = (
    directiveNames: string[] = [],
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: GenerationDirectivePolicies = {}
): ResolvedGenerationDirectives => {
    const resolved = {
        directives: [],
        warnings: [],
    } satisfies ResolvedGenerationDirectives

    directiveNames.forEach(directiveName => {
        const policy = getGenerationDirectivePolicy(directiveName, targetKind, directivePolicies)
        if (!policy) return

        applyGenerationDirectivePolicy(directiveName, policy, resolved)
    })

    return resolved
}

export const shouldForceNonNull = (
    directives: DirectiveNode[] = [],
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: StructuralDirectivePolicies = {}
): boolean => resolveStructuralSelectionDirectives(directives, targetKind, directivePolicies).forceNonNull

const getDirectivePolicyTargetForSelection = (
    selection: SelectionNode
): ConstValues<typeof SELECTION_MODEL_KIND> => {
    switch (selection.kind) {
        case Kind.FIELD:
            return SELECTION_MODEL_KIND.FIELD
        case Kind.FRAGMENT_SPREAD:
            return SELECTION_MODEL_KIND.FRAGMENT_SPREAD
        case Kind.INLINE_FRAGMENT:
            return SELECTION_MODEL_KIND.INLINE_FRAGMENT
    }
}

export const resolveStructuralSelectionDirectivesForNode = (
    selection: SelectionNode,
    directivePolicies: StructuralDirectivePolicies = {}
): ResolvedStructuralDirectives => resolveStructuralSelectionDirectives(
    selection.directives ? [ ...selection.directives ] : [],
    getDirectivePolicyTargetForSelection(selection),
    directivePolicies
)
