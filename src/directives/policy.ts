import type { ConstValues } from '../lib/types'
import type { TsType } from '../ts-type'

import { DIRECTIVE_POLICY_EFFECT } from './kinds'
import { SELECTION_MODEL_KIND } from '../kinds'

type DirectivePolicyEffect = typeof DIRECTIVE_POLICY_EFFECT[keyof typeof DIRECTIVE_POLICY_EFFECT]

type Policy<
    T extends DirectivePolicyEffect,
    Extra extends object = Record<never, never>,
> = { effect: T } & Extra

export type DirectiveOverrideType = TsType

export type StructuralDirectivePolicy =
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.IGNORE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.EXCLUDE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.CONDITIONAL>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.NONNULL>

export type GenerationDirectivePolicy =
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.IGNORE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.OVERRIDE_TYPE, { type: DirectiveOverrideType }>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.WARN, { message?: string }>

export type DirectivePolicy = StructuralDirectivePolicy | GenerationDirectivePolicy

export type DirectivePoliciesByKind<TPolicy> =
    Partial<Record<ConstValues<typeof SELECTION_MODEL_KIND>, TPolicy>>

export type StructuralDirectiveNodePolicies = DirectivePoliciesByKind<StructuralDirectivePolicy>

export type GenerationDirectiveNodePolicies = DirectivePoliciesByKind<GenerationDirectivePolicy>

export type DirectiveNodePolicies = DirectivePoliciesByKind<DirectivePolicy>

export type NormalizedDirectivePolicies = Record<string, DirectivePoliciesByKind<DirectivePolicy>>

export type StructuralDirectivePolicies = Record<string, StructuralDirectiveNodePolicies>

export type GenerationDirectivePolicies = Record<string, GenerationDirectiveNodePolicies>
