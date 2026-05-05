import type {
    DirectiveNodePolicies,
    DirectivePolicy,
} from './policy'

export type ConfigDirectivePolicies = Record<string, DirectivePolicy | DirectiveNodePolicies>

export type {
    DirectiveNodePolicies,
    DirectivePolicy,
    StructuralDirectiveNodePolicies,
    StructuralDirectivePolicies,
    StructuralDirectivePolicy,
} from './policy'

export type {
    ConditionalSelectionState,
    ResolvedGenerationDirectives,
    ResolvedStructuralDirectives,
} from './resolved'
