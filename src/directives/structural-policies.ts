import type {
    DirectiveNodePolicies,
    DirectivePolicy,
    StructuralDirectiveNodePolicies,
    StructuralDirectivePolicies,
    StructuralDirectivePolicy,
} from './types'

import { DIRECTIVE_POLICY_EFFECT } from './kinds'

const isStructuralDirectivePolicy = (
    policy: DirectivePolicy
): policy is StructuralDirectivePolicy => policy.effect === DIRECTIVE_POLICY_EFFECT.IGNORE
    || policy.effect === DIRECTIVE_POLICY_EFFECT.EXCLUDE
    || policy.effect === DIRECTIVE_POLICY_EFFECT.CONDITIONAL
    || policy.effect === DIRECTIVE_POLICY_EFFECT.NONNULL

const filterStructuralNodePolicies = (
    policy: DirectiveNodePolicies
): StructuralDirectiveNodePolicies => {
    const structuralPolicies: StructuralDirectiveNodePolicies = {}

    Object.entries(policy).forEach(([ targetKind, scopedPolicy ]) => {
        if (scopedPolicy && isStructuralDirectivePolicy(scopedPolicy)) {
            structuralPolicies[targetKind as keyof StructuralDirectiveNodePolicies] = scopedPolicy
        }
    })

    return structuralPolicies
}

export const makeStructuralDirectivePolicies = (
    directivePolicies: Record<string, DirectivePolicy | DirectiveNodePolicies> = {}
): StructuralDirectivePolicies => {
    const structuralPolicies: StructuralDirectivePolicies = {}

    Object.entries(directivePolicies).forEach(([ directiveName, policy ]) => {
        if ('effect' in policy) {
            if (isStructuralDirectivePolicy(policy)) {
                structuralPolicies[directiveName] = policy
            }
            return
        }

        const scopedStructuralPolicies = filterStructuralNodePolicies(policy)
        if (Object.keys(scopedStructuralPolicies).length > 0) {
            structuralPolicies[directiveName] = scopedStructuralPolicies
        }
    })

    return structuralPolicies
}
