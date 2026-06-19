import type { ConfigDirectivePolicies } from './directives/types'
import type { CustomScalarMappingRecord } from './scalars/types'

export interface PluginConfig {
    prefix?: string;
    scope?: string;
    paths?: ConfigPaths;
    relativeToCwd?: boolean;
    schemaOutputDirectory?: string;
    scalars?: ConfigScalars;
    namingConvention?: ConfigNamingConvention;
    directivePolicies?: ConfigDirectivePolicies;
}

export type ConfigScalars = CustomScalarMappingRecord
export type ConfigPaths = Record<string, string | string[]>

export const NAMING_STYLE = {
    KEEP: 'keep',
    PASCAL_CASE: 'pascalCase',
    CAMEL_CASE: 'camelCase',
    SNAKE_CASE: 'snakeCase',
} as const

export type NAMING_STYLE = typeof NAMING_STYLE[keyof typeof NAMING_STYLE]

export type ConfigNamingConvention = NAMING_STYLE | {
    typeNames?: NAMING_STYLE;
    enumValues?: NAMING_STYLE;
    operationNames?: NAMING_STYLE;
    fragmentNames?: NAMING_STYLE;
    transformUnderscore?: boolean;
}
