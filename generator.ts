import { generate } from '@graphql-codegen/cli'

generate({
    overwrite: true,
    schema: 'tests/fixtures/schema.graphql',
    documents: [ 'tests/fixtures/documents/**/*.graphql' ],
    generates: {
        'src/generated/types.d.ts': {
            plugins: [ './dist/codegen-plugin/index.js' ],
            config: {
                prefix: '~tests/',
                scope: 'fixtures/documents/',
                emit: 'types',
                scalars: {
                    DateTime: 'string',
                },
            },
        },
    },
})
