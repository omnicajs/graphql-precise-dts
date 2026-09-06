const root: string = __dirname

export default {
    root,
    execution: { mode: 'parallel', maxWorkers: 2 },
    schemas: {
        core: {
            file: 'schema.graphql',
            typesModule: '@app/graphql/schema',
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
