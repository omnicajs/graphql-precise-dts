import type { ConfigDirectivePolicies } from './directives/types'
import type { CustomScalarMappingRecord } from './scalars/types'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    relativeToCwd?: boolean;
    scalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

export type ConfigScalars = CustomScalarMappingRecord
