import type { ConfigDirectivePolicies } from '../config'
import type { DirectiveNode } from 'graphql'
import type {
    DirectiveNodePolicies,
    DirectivePolicy,
} from '../config'
import type { ValueNode } from 'graphql'

import { DefinitionNodeKind } from '../enums/model-kinds'
import { Kind } from 'graphql'

import { directivePolicyEffects } from '../config'

const conditionalDirectives = {
    INCLUDE: 'include',
    SKIP: 'skip',
} as const

export const CONDITIONAL_DIRECTIVES: ReadonlySet<string> = new Set(Object.values(conditionalDirectives))

export const selectionStates = {
    INCLUDED: 'included',
    EXCLUDED: 'excluded',
    CONDITIONAL: 'conditional',
} as const
export type ConditionalSelectionState = typeof selectionStates[keyof typeof selectionStates]

export type ResolvedSelectionDirectives = {
    directives: string[];
    overrideTypeTs?: string;
    state: ConditionalSelectionState;
    warnings: string[];
}

export const isConditionalSelectionState = (
    state: ConditionalSelectionState
): boolean => state === selectionStates.CONDITIONAL

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
    targetKind: DefinitionNodeKind,
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
    resolved.state = selectionStates.CONDITIONAL
    resolved.directives.push(directiveName)
}

const resolveConditionalDirective = (
    directive: DirectiveNode,
    resolved: ResolvedSelectionDirectives
): ConditionalSelectionState | undefined => {
    if (!CONDITIONAL_DIRECTIVES.has(directive.name.value)) return

    const ifValue = getDirectiveIfValue(directive)

    if (directive.name.value === conditionalDirectives.SKIP) {
        if (ifValue === true) return selectionStates.EXCLUDED
        if (ifValue === undefined) markSelectionConditional(resolved, directive.name.value)

        return
    } else if (directive.name.value === conditionalDirectives.INCLUDE) {
        if (ifValue === false) return selectionStates.EXCLUDED
        if (ifValue === undefined) markSelectionConditional(resolved, directive.name.value)
    }
}

const applyDirectivePolicy = (
    directive: DirectiveNode,
    policy: DirectivePolicy,
    resolved: ResolvedSelectionDirectives
): ConditionalSelectionState | undefined => {
    switch (policy.effect) {
        case directivePolicyEffects.IGNORE:
        case directivePolicyEffects.NONNULL:
            return
        case directivePolicyEffects.EXCLUDE:
            return selectionStates.EXCLUDED
        case directivePolicyEffects.CONDITIONAL:
            markSelectionConditional(resolved, directive.name.value)
            return
        case directivePolicyEffects.OVERRIDE_TYPE:
            resolved.overrideTypeTs = policy.type
            return
        case directivePolicyEffects.WARN:
            resolved.warnings.push(policy.message ?? `Directive "@${directive.name.value}" requires manual review`)
            return
    }
}

export const resolveSelectionDirectives = (
    directives: DirectiveNode[] = [],
    targetKind: DefinitionNodeKind,
    directivePolicies: ConfigDirectivePolicies = {}
): ResolvedSelectionDirectives => {
    const resolved = {
        directives: [],
        state: selectionStates.INCLUDED,
        warnings: [],
    } satisfies ResolvedSelectionDirectives

    for (const directive of directives) {
        const conditionalState = resolveConditionalDirective(directive, resolved)
        if (conditionalState === selectionStates.EXCLUDED) return { ...resolved, state: selectionStates.EXCLUDED }
        if (conditionalState) continue

        const policy = getDirectivePolicy(directive.name.value, targetKind, directivePolicies)
        if (!policy) continue

        const policyState = applyDirectivePolicy(directive, policy, resolved)
        if (policyState === selectionStates.EXCLUDED) return { ...resolved, state: selectionStates.EXCLUDED }
    }

    return resolved
}

export const shouldForceNonNull = (
    directives: DirectiveNode[] = [],
    targetKind: DefinitionNodeKind,
    directivePolicies: ConfigDirectivePolicies = {}
): boolean => directives.some(directive => {
    const policy = getDirectivePolicy(directive.name.value, targetKind, directivePolicies)

    return policy?.effect === directivePolicyEffects.NONNULL
})
