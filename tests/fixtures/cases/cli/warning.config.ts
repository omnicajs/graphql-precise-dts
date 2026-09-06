export default {
    root: __dirname,
    execution: { mode: 'parallel', maxWorkers: 2 },
    schemas: {
        core: {
            file: 'schema.graphql',
            typesModule: '@app/graphql/schema',
            scalars: {
                Date: { kind: 'named', name: 'Query' },
            },
        },
    },
    projects: {
        app: {
            root: 'documents',
            targets: {
                core: {
                    schema: 'core',
                    documents: { files: ['viewer.graphql'] },
                    outputs: { tree: { root: 'generated' } },
                },
            },
        },
    },
} as const
