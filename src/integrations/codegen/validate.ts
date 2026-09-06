import type { CodegenConfig } from './types'

import {
    directivePolicies,
    makeValidationError,
    namingPolicy,
    typenamePolicy,
    resolveConfig,
    scalarMappings,
} from '@/config/validate'
import { z } from 'zod'

const string = z.string({ error: 'expected a string' })

const config: z.ZodType<CodegenConfig> = z.object({
    root: string.optional(),
    typesModule: string,
    enumsModule: string.optional(),
    scalars: scalarMappings.optional(),
    directives: directivePolicies.optional(),
    naming: namingPolicy.optional(),
    typename: typenamePolicy.optional(),
    resolve: resolveConfig.optional(),
}, { error: 'expected an object' })

export function validateCodegenConfig(value: unknown): asserts value is CodegenConfig {
    const result = config.safeParse(value)
    if (result.success) return

    throw makeValidationError('Codegen plugin configuration', result.error)
}
