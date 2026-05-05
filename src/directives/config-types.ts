import type {
    DirectiveNodePolicies,
    DirectivePolicy,
} from './policy'

export type ConfigDirectivePolicies = Record<string, DirectivePolicy | DirectiveNodePolicies>
