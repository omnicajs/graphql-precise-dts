import type { PluginConfig } from './config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { Types } from '@graphql-codegen/plugin-helpers'

import { generatePluginOutput } from './modules/orchestration/generate-plugin-output'

export const plugin: PluginFunction<PluginConfig, Types.ComplexPluginOutput> = (
    schema,
    documents,
    config,
    info
) => generatePluginOutput(schema, documents, config, info)
