import {
    expectTypeOf,
    test,
} from 'vitest'

import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type {
    CodegenConfig,
    PluginConfig,
} from '@/integrations/codegen'

import { plugin } from '@/integrations/codegen'

test('exposes a typed GraphQL Code Generator plugin configuration', () => {
    expectTypeOf(plugin).toEqualTypeOf<PluginFunction<CodegenConfig, string>>()
    expectTypeOf<PluginConfig>().toEqualTypeOf<CodegenConfig>()

    const config = {
        root: '/workspace',
        typesModule: '@app/graphql/schema',
        naming: { enumMembers: 'pascalCase' },
        typename: 'abstract',
        resolve: {
            alias: {
                'src/graphql': '@app/graphql',
            },
        },
    } satisfies CodegenConfig

    expectTypeOf(config.typesModule).toEqualTypeOf<string>()

    // @ts-expect-error typesModule identifies the schema contract imported by declarations
    const missingTypesModule: CodegenConfig = { root: '/workspace' }

    expectTypeOf(missingTypesModule).toEqualTypeOf<CodegenConfig>()
})
