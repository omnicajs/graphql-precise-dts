import type {
    CacheConfig,
    Config,
    ExecutionConfig,
    LocksConfig,
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
    const TLocks extends LocksConfig | undefined = undefined,
>(config: Config<
    TSchemas,
    TProjects,
    TResolve,
    TExecution,
    TCache,
    TLocks
>): Config<TSchemas, TProjects, TResolve, TExecution, TCache, TLocks> => config
