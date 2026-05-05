import type {
    ConfigDirectivePolicies,
    DirectiveNodePolicies,
    DirectivePolicy,
    GenerationDirectivePolicies,
    GenerationDirectivePolicy,
    NormalizedDirectivePolicies,
    StructuralDirectiveNodePolicies,
    StructuralDirectivePolicies,
    StructuralDirectivePolicy,
} from './types'
import type { ConstValues } from '../lib/types'

import { DIRECTIVE_POLICY_EFFECT } from './kinds'
import { SELECTION_MODEL_KIND } from '../kinds'

const isStructuralDirectivePolicy = (
    policy: DirectivePolicy
): policy is StructuralDirectivePolicy => policy.effect === DIRECTIVE_POLICY_EFFECT.IGNORE
    || policy.effect === DIRECTIVE_POLICY_EFFECT.EXCLUDE
    || policy.effect === DIRECTIVE_POLICY_EFFECT.CONDITIONAL
    || policy.effect === DIRECTIVE_POLICY_EFFECT.NONNULL

const isGenerationDirectivePolicy = (
    policy: DirectivePolicy
): policy is GenerationDirectivePolicy => policy.effect === DIRECTIVE_POLICY_EFFECT.IGNORE
    || policy.effect === DIRECTIVE_POLICY_EFFECT.OVERRIDE_TYPE
    || policy.effect === DIRECTIVE_POLICY_EFFECT.WARN

const normalizeDirectiveNodePolicies = (
    policy: DirectiveNodePolicies
): DirectiveNodePolicies => {
    const normalizedPolicies: DirectiveNodePolicies = {}

    Object.entries(policy).forEach(([ targetKind, scopedPolicy ]) => {
        if (scopedPolicy) {
            normalizedPolicies[targetKind as keyof DirectiveNodePolicies] = scopedPolicy
        }
    })

    return normalizedPolicies
}

const makeDirectiveNodePolicies = <TPolicy extends DirectivePolicy>(
    policy: TPolicy
): Record<ConstValues<typeof SELECTION_MODEL_KIND>, TPolicy> => ({
        [SELECTION_MODEL_KIND.FIELD]: policy,
        [SELECTION_MODEL_KIND.FRAGMENT_SPREAD]: policy,
        [SELECTION_MODEL_KIND.INLINE_FRAGMENT]: policy,
    })

const filterGenerationNodePolicies = (
    policy: DirectiveNodePolicies
): Record<string, GenerationDirectivePolicy> => {
    const generationPolicies: Record<string, GenerationDirectivePolicy> = {}

    Object.entries(policy).forEach(([ targetKind, scopedPolicy ]) => {
        if (scopedPolicy && isGenerationDirectivePolicy(scopedPolicy)) {
            generationPolicies[targetKind] = scopedPolicy
        }
    })

    return generationPolicies
}

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

export const makeNormalizedDirectivePolicies = (
    directivePolicies: ConfigDirectivePolicies = {}
): NormalizedDirectivePolicies => {
    const normalizedPolicies: NormalizedDirectivePolicies = {}

    Object.entries(directivePolicies).forEach(([ directiveName, policy ]) => {
        normalizedPolicies[directiveName] = 'effect' in policy
            ? makeDirectiveNodePolicies(policy)
            : normalizeDirectiveNodePolicies(policy)
    })

    return normalizedPolicies
}

export const makeStructuralDirectivePolicies = (
    directivePolicies: ConfigDirectivePolicies = {}
): StructuralDirectivePolicies => {
    const structuralPolicies: StructuralDirectivePolicies = {}

    Object.entries(makeNormalizedDirectivePolicies(directivePolicies)).forEach(([ directiveName, policy ]) => {
        const scopedStructuralPolicies = filterStructuralNodePolicies(policy)
        if (Object.keys(scopedStructuralPolicies).length > 0) {
            structuralPolicies[directiveName] = scopedStructuralPolicies
        }
    })

    return structuralPolicies
}

export const makeGenerationDirectivePolicies = (
    directivePolicies: ConfigDirectivePolicies = {}
): GenerationDirectivePolicies => {
    const generationPolicies: GenerationDirectivePolicies = {}

    Object.entries(makeNormalizedDirectivePolicies(directivePolicies)).forEach(([ directiveName, policy ]) => {
        const scopedGenerationPolicies = filterGenerationNodePolicies(policy)
        if (Object.keys(scopedGenerationPolicies).length > 0) {
            generationPolicies[directiveName] = scopedGenerationPolicies
        }
    })

    return generationPolicies
}
