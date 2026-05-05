import {
    defineString,
    plugin,
} from '../../src'
import { generate } from '@graphql-codegen/cli'

const LOCAL_PLUGIN_NAME = 'graphql-precise-dts'
const supportedPluginNames = new Set([
    `@graphql-codegen/${LOCAL_PLUGIN_NAME}`,
])

const main = async (): Promise<void> => {
    await generate({
        overwrite: true,
        pluginLoader(name) {
            if (supportedPluginNames.has(name)) return { plugin }

            throw new Error(`Unsupported plugin: ${name}`)
        },
        schema: 'tests/fixtures/schema.graphql',
        documents: [ 'tests/fixtures/documents/**/*.graphql' ],
        generates: {
            'tests/fixtures/generated/types.d.ts': {
                plugins: [ LOCAL_PLUGIN_NAME ],
                config: {
                    prefix: '~tests/',
                    scope: 'fixtures/documents/',
                    emit: 'types',
                    scalars: {
                        DateTime: defineString(),
                    },
                },
            },
        },
    })
}

void main()
