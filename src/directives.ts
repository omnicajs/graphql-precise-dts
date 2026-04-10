import type { ConfigDirectivePolicies } from './config'
import type { ConstValues } from './lib/types'
import type { DirectiveNode } from 'graphql'
import type {
    DirectiveNodePolicies,
    DirectivePolicy,
} from './config'
import type { ValueNode } from 'graphql'

import { Kind } from 'graphql'
import { SELECTION_MODEL_KIND } from './models/kinds'

import { DIRECTIVE_POLICY_EFFECT } from './config'

const CONDITIONAL_DIRECTIVE = {
    INCLUDE: 'include',
    SKIP: 'skip',
} as const

const conditionalDirectives: ReadonlySet<string> = new Set(Object.values(CONDITIONAL_DIRECTIVE))

export const SELECTION_STATE = {
    INCLUDED: 'included',
    EXCLUDED: 'excluded',
    CONDITIONAL: 'conditional',
} as const
export type ConditionalSelectionState = typeof SELECTION_STATE[keyof typeof SELECTION_STATE]

export type ResolvedSelectionDirectives = {
    directives: string[];
    overrideTypeTs?: string;
    state: ConditionalSelectionState;
    warnings: string[];
}

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

const isDirectiveNodePolicies = (
    policy: DirectivePolicy | DirectiveNodePolicies
): policy is DirectiveNodePolicies => typeof policy === 'object'
    && policy !== null
    && !('effect' in policy)

const getDirectivePolicy = (
    directiveName: string,
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: ConfigDirectivePolicies = {}
): DirectivePolicy | undefined => {
    const policy = directivePolicies[directiveName]
    if (!policy) return
    if (!isDirectiveNodePolicies(policy)) return policy

    const scopedPolicy = policy[targetKind]
    if (!scopedPolicy) return

    return scopedPolicy
}

const markSelectionConditional = (
    resolved: ResolvedSelectionDirectives,
    directiveName: string
) => {
    resolved.state = SELECTION_STATE.CONDITIONAL
    resolved.directives.push(directiveName)
}

const resolveConditionalDirective = (
    directive: DirectiveNode,
    resolved: ResolvedSelectionDirectives
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

const applyDirectivePolicy = (
    directive: DirectiveNode,
    policy: DirectivePolicy,
    resolved: ResolvedSelectionDirectives
): ConditionalSelectionState | undefined => {
    switch (policy.effect) {
        case DIRECTIVE_POLICY_EFFECT.IGNORE:
        case DIRECTIVE_POLICY_EFFECT.NONNULL:
            return
        case DIRECTIVE_POLICY_EFFECT.EXCLUDE:
            return SELECTION_STATE.EXCLUDED
        case DIRECTIVE_POLICY_EFFECT.CONDITIONAL:
            markSelectionConditional(resolved, directive.name.value)
            return
        case DIRECTIVE_POLICY_EFFECT.OVERRIDE_TYPE:
            resolved.overrideTypeTs = policy.type
            return
        case DIRECTIVE_POLICY_EFFECT.WARN:
            resolved.warnings.push(policy.message ?? `Directive "@${directive.name.value}" requires manual review`)
            return
    }
}

export const resolveSelectionDirectives = (
    directives: DirectiveNode[] = [],
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: ConfigDirectivePolicies = {}
): ResolvedSelectionDirectives => {
    const resolved = {
        directives: [],
        state: SELECTION_STATE.INCLUDED,
        warnings: [],
    } satisfies ResolvedSelectionDirectives

    for (const directive of directives) {
        const conditionalState = resolveConditionalDirective(directive, resolved)
        if (conditionalState === SELECTION_STATE.EXCLUDED) return { ...resolved, state: SELECTION_STATE.EXCLUDED }
        if (conditionalState) continue

        const policy = getDirectivePolicy(directive.name.value, targetKind, directivePolicies)
        if (!policy) continue

        const policyState = applyDirectivePolicy(directive, policy, resolved)
        if (policyState === SELECTION_STATE.EXCLUDED) return { ...resolved, state: SELECTION_STATE.EXCLUDED }
    }

    return resolved
}

export const shouldForceNonNull = (
    directives: DirectiveNode[] = [],
    targetKind: ConstValues<typeof SELECTION_MODEL_KIND>,
    directivePolicies: ConfigDirectivePolicies = {}
): boolean => directives.some(directive => {
    const policy = getDirectivePolicy(directive.name.value, targetKind, directivePolicies)

    return policy?.effect === DIRECTIVE_POLICY_EFFECT.NONNULL
})
