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

export type StructuralDirectiveNodePolicies =
    Partial<Record<ConstValues<typeof SELECTION_MODEL_KIND>, StructuralDirectivePolicy>>

export type GenerationDirectiveNodePolicies =
    Partial<Record<ConstValues<typeof SELECTION_MODEL_KIND>, GenerationDirectivePolicy>>

export type DirectiveNodePolicies = Partial<Record<ConstValues<typeof SELECTION_MODEL_KIND>, DirectivePolicy>>

export type StructuralDirectivePolicies = Record<string, StructuralDirectivePolicy | StructuralDirectiveNodePolicies>
