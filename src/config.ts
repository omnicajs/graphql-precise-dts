import type { ConstValues } from './lib/types'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ScalarShape } from './scalars/types'

import { SELECTION_MODEL_KIND } from './models/kinds'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    relativeToCwd?: boolean;
    recoverExternalFragments?: boolean;
    scalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

export type Schema = Parameters<PluginFunction<PluginConfig>>[0]
export type DocumentFile = Parameters<PluginFunction<PluginConfig>>[1][number]

export type TsTypeString = string
export type ConfigScalars = { [K in string]: TsTypeString | Partial<ScalarShape<TsTypeString, TsTypeString>> }

export const DIRECTIVE_POLICY_EFFECT = {
    IGNORE: 'ignore',
    EXCLUDE: 'exclude',
    CONDITIONAL: 'conditional',
    NONNULL: 'nonnull',
    OVERRIDE_TYPE: 'override-type',
    WARN: 'warn',
} as const
export type DirectivePolicyEffect = typeof DIRECTIVE_POLICY_EFFECT[keyof typeof DIRECTIVE_POLICY_EFFECT]

type Policy<
    T extends DirectivePolicyEffect,
    Extra extends object = Record<never, never>,
> = { effect: T } & Extra

export type DirectivePolicy =
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.IGNORE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.EXCLUDE>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.CONDITIONAL>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.NONNULL>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.OVERRIDE_TYPE, { type: string }>
    | Policy<typeof DIRECTIVE_POLICY_EFFECT.WARN, { message?: string }>

export type DirectiveNodePolicies = Partial<Record<ConstValues<typeof SELECTION_MODEL_KIND>, DirectivePolicy>>
export type ConfigDirectivePolicies = Record<string, DirectivePolicy | DirectiveNodePolicies>
