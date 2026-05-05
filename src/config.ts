import type { CustomScalarMappings } from './scalars/types'
import type { ConfigDirectivePolicies } from './directives/types'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    relativeToCwd?: boolean;
    scalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

export type ConfigScalars = CustomScalarMappings
