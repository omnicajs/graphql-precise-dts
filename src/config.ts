import type { ScalarShape } from './scalars/types'

import { SelectionModelKind } from './models/kinds'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    relativeToCwd?: boolean;
    scalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

export type TsTypeString = string
export type ConfigScalars = { [K in string]: TsTypeString | Partial<ScalarShape<TsTypeString, TsTypeString>> }

export const DIRECTIVE_POLICY_EFFECTS = {
    IGNORE: 'ignore',
    EXCLUDE: 'exclude',
    CONDITIONAL: 'conditional',
    NONNULL: 'nonnull',
    OVERRIDE_TYPE: 'override-type',
    WARN: 'warn',
} as const
export type DirectivePolicyEffect = typeof DIRECTIVE_POLICY_EFFECTS[keyof typeof DIRECTIVE_POLICY_EFFECTS]

type Policy<
    T extends DirectivePolicyEffect,
    Extra extends object = Record<never, never>,
> = { effect: T } & Extra

export type DirectivePolicy =
    | Policy<typeof DIRECTIVE_POLICY_EFFECTS.IGNORE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECTS.EXCLUDE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECTS.CONDITIONAL>
    | Policy<typeof DIRECTIVE_POLICY_EFFECTS.NONNULL>
    | Policy<typeof DIRECTIVE_POLICY_EFFECTS.OVERRIDE_TYPE, { type: string }>
    | Policy<typeof DIRECTIVE_POLICY_EFFECTS.WARN, { message?: string }>

export type DirectiveNodePolicies = Partial<Record<SelectionModelKind, DirectivePolicy>>
export type ConfigDirectivePolicies = Record<string, DirectivePolicy | DirectiveNodePolicies>
