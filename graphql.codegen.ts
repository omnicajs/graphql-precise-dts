import type { CodegenConfig } from '@graphql-codegen/cli'

export default {
    schema: 'tests/__fixtures__/schema.graphql',
    documents: 'tests/__fixtures__/api/**/*.graphql',
    generates: {
        'src/typedGraphql.ts': {
            plugins: [
                'typescript',
                'typescript-operations',
                'typed-document-node',
            ],
            config: {
                dedupeFragments: true,
                inlineFragmentTypes: 'combine',
                preResolveTypes: true,
                printFieldsOnNewLines: true,
                avoidOptionals: {
                    field: true,
                },
                scalars: {
                    DateTime: 'string',
                }
            }
        }
    },
} satisfies CodegenConfig