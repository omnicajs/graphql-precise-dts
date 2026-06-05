import type { ConfigDirectivePolicies } from './directives/types'
import type { CustomScalarMappingRecord } from './scalars/types'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    relativeToCwd?: boolean;
    schemaOutputDirectory?: string;
    scalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

export type ConfigScalars = CustomScalarMappingRecord
