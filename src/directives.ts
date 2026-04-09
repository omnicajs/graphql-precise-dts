import type { ConfigDirectivePolicies } from './config'
import type { DirectiveNode } from 'graphql'
import type {
    DirectiveNodePolicies,
    DirectivePolicy,
} from './config'
import type { ValueNode } from 'graphql'

import { Kind } from 'graphql'
import { SelectionModelKind } from './models/kinds'

import { DIRECTIVE_POLICY_EFFECTS } from './config'

const CONDITIONAL_DIRECTIVES = {
    INCLUDE: 'include',
    SKIP: 'skip',
} as const

const conditionalDirectives: ReadonlySet<string> = new Set(Object.values(CONDITIONAL_DIRECTIVES))

export const SELECTION_STATES = {
    INCLUDED: 'included',
    EXCLUDED: 'excluded',
    CONDITIONAL: 'conditional',
} as const
export type ConditionalSelectionState = typeof SELECTION_STATES[keyof typeof SELECTION_STATES]

export type ResolvedSelectionDirectives = {
    directives: string[];
    overrideTypeTs?: string;
    state: ConditionalSelectionState;
    warnings: string[];
}

export const isConditionalSelectionState = (
    state: ConditionalSelectionState
): boolean => state === SELECTION_STATES.CONDITIONAL

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
    targetKind: SelectionModelKind,
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
    resolved.state = SELECTION_STATES.CONDITIONAL
    resolved.directives.push(directiveName)
}

const resolveConditionalDirective = (
    directive: DirectiveNode,
    resolved: ResolvedSelectionDirectives
): ConditionalSelectionState | undefined => {
    if (!conditionalDirectives.has(directive.name.value)) return

    const ifValue = getDirectiveIfValue(directive)

    if (directive.name.value === CONDITIONAL_DIRECTIVES.SKIP) {
        if (ifValue === true) return SELECTION_STATES.EXCLUDED
        if (ifValue === undefined) markSelectionConditional(resolved, directive.name.value)

        return
    } else if (directive.name.value === CONDITIONAL_DIRECTIVES.INCLUDE) {
        if (ifValue === false) return SELECTION_STATES.EXCLUDED
        if (ifValue === undefined) markSelectionConditional(resolved, directive.name.value)
    }
}

const applyDirectivePolicy = (
    directive: DirectiveNode,
    policy: DirectivePolicy,
    resolved: ResolvedSelectionDirectives
): ConditionalSelectionState | undefined => {
    switch (policy.effect) {
        case DIRECTIVE_POLICY_EFFECTS.IGNORE:
        case DIRECTIVE_POLICY_EFFECTS.NONNULL:
            return
        case DIRECTIVE_POLICY_EFFECTS.EXCLUDE:
            return SELECTION_STATES.EXCLUDED
        case DIRECTIVE_POLICY_EFFECTS.CONDITIONAL:
            markSelectionConditional(resolved, directive.name.value)
            return
        case DIRECTIVE_POLICY_EFFECTS.OVERRIDE_TYPE:
            resolved.overrideTypeTs = policy.type
            return
        case DIRECTIVE_POLICY_EFFECTS.WARN:
            resolved.warnings.push(policy.message ?? `Directive "@${directive.name.value}" requires manual review`)
            return
    }
}

export const resolveSelectionDirectives = (
    directives: DirectiveNode[] = [],
    targetKind: SelectionModelKind,
    directivePolicies: ConfigDirectivePolicies = {}
): ResolvedSelectionDirectives => {
    const resolved = {
        directives: [],
        state: SELECTION_STATES.INCLUDED,
        warnings: [],
    } satisfies ResolvedSelectionDirectives

    for (const directive of directives) {
        const conditionalState = resolveConditionalDirective(directive, resolved)
        if (conditionalState === SELECTION_STATES.EXCLUDED) return { ...resolved, state: SELECTION_STATES.EXCLUDED }
        if (conditionalState) continue

        const policy = getDirectivePolicy(directive.name.value, targetKind, directivePolicies)
        if (!policy) continue

        const policyState = applyDirectivePolicy(directive, policy, resolved)
        if (policyState === SELECTION_STATES.EXCLUDED) return { ...resolved, state: SELECTION_STATES.EXCLUDED }
    }

    return resolved
}

export const shouldForceNonNull = (
    directives: DirectiveNode[] = [],
    targetKind: SelectionModelKind,
    directivePolicies: ConfigDirectivePolicies = {}
): boolean => directives.some(directive => {
    const policy = getDirectivePolicy(directive.name.value, targetKind, directivePolicies)

    return policy?.effect === DIRECTIVE_POLICY_EFFECTS.NONNULL
})
