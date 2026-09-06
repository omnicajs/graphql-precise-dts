import type {
    CacheConfig,
    Config,
    ExecutionConfig,
    ProjectsConfig,
    ResolveConfig,
    SchemaId,
    SchemasConfig,
} from './types'

export const defineConfig = <
    const TSchemas extends SchemasConfig,
    const TProjects extends ProjectsConfig<SchemaId<NoInfer<TSchemas>>>,
    const TResolve extends ResolveConfig | undefined = undefined,
    const TExecution extends ExecutionConfig | undefined = undefined,
    const TCache extends CacheConfig | undefined = undefined,
>(config: Config<
    TSchemas,
    TProjects,
    TResolve,
    TExecution,
    TCache
>): Config<TSchemas, TProjects, TResolve, TExecution, TCache> => config
