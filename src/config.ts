import type { ScalarShape } from './types/scalars'

import { DefinitionNodeKind } from './enums/model-kinds'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    relativeToCwd?: boolean;
    scalars?: ConfigScalar;
    directivePolicies?: ConfigDirectivePolicies;
}

export type ScalarTsType = string
export type ConfigScalar = { [K in string]: ScalarTsType | Partial<ScalarShape<ScalarTsType, ScalarTsType>> }

export const directivePolicyEffects = {
    IGNORE: 'ignore',
    EXCLUDE: 'exclude',
    CONDITIONAL: 'conditional',
    NONNULL: 'nonnull',
    OVERRIDE_TYPE: 'override-type',
    WARN: 'warn',
} as const
export type DirectivePolicyEffect = typeof directivePolicyEffects[keyof typeof directivePolicyEffects]

type Policy<
    T extends DirectivePolicyEffect,
    Extra extends object = Record<never, never>,
> = { effect: T } & Extra

export type DirectivePolicy =
    | Policy<typeof directivePolicyEffects.IGNORE>
    | Policy<typeof directivePolicyEffects.EXCLUDE>
    | Policy<typeof directivePolicyEffects.CONDITIONAL>
    | Policy<typeof directivePolicyEffects.NONNULL>
    | Policy<typeof directivePolicyEffects.OVERRIDE_TYPE, { type: string }>
    | Policy<typeof directivePolicyEffects.WARN, { message?: string }>

export type DirectiveNodePolicies = Partial<Record<DefinitionNodeKind, DirectivePolicy>>
export type ConfigDirectivePolicies = Record<string, DirectivePolicy | DirectiveNodePolicies>
