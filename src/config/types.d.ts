import type { TsType } from './ts-type'

export type ScalarMapping = TsType | {
    input?: TsType
    output?: TsType
}

export type ScalarMappings = Readonly<Record<string, ScalarMapping>>

export type SharedDirectivePolicy =
    | { effect: 'conditional' }
    | { effect: 'ignore' }
    | { effect: 'warn'; message?: string }

export type FieldDirectivePolicy = SharedDirectivePolicy
    | { effect: 'nonnull' }
    | { effect: 'override'; type: TsType }

export type DirectivePolicy = FieldDirectivePolicy | {
    field?: FieldDirectivePolicy
    fragmentSpread?: SharedDirectivePolicy
    inlineFragment?: SharedDirectivePolicy
}

export type DirectivePolicies = Readonly<Record<string, DirectivePolicy>>

export type NamingStyle = 'keep' | 'pascalCase' | 'camelCase' | 'snakeCase'

export type NamingPolicy = NamingStyle | {
    typeNames?: NamingStyle
    operationNames?: NamingStyle
    fragmentNames?: NamingStyle
    enumMembers?: NamingStyle
}

export type TypenamePolicy = 'optional' | 'abstract'

export type SchemaOutputsConfig = {
    root: string
    types: string
    enums?: string
}

export type SchemaConfig = {
    file: string
    typesModule: string
    enumsModule?: string
    scalars?: ScalarMappings
    directives?: DirectivePolicies
    naming?: NamingPolicy
    typename?: TypenamePolicy
    outputs?: SchemaOutputsConfig
}

export type SchemasConfig = Readonly<Record<string, SchemaConfig>>

export type SchemaId<TSchemas extends SchemasConfig> = Extract<keyof TSchemas, string>

export type ResolveConfig = {
    alias?: Readonly<Record<string, string>>
}

export type CacheConfig = {
    directory?: string
    enabled?: boolean
}

export type LocksConfig = {
    directory?: string
}

export type ExecutionConfig =
    | {
        mode?: 'sequential'
        maxWorkers?: never
    }
    | {
        mode: 'parallel'
        maxWorkers: number
    }

export type DocumentSelector =
    | { files: ReadonlyArray<string> }
    | {
        glob: {
            include: ReadonlyArray<string>
            exclude?: ReadonlyArray<string>
        }
    }
    | { regexp: RegExp }

export type TargetConfig<TSchemaId extends string> = {
    schema: TSchemaId
    documents: DocumentSelector
    outputs: {
        tree: {
            root: string
        }
        aggregate?: {
            file: string
        }
    }
}

export type TargetsConfig<TSchemaId extends string> = Readonly<Record<
    string,
    TargetConfig<TSchemaId>
>>

export type ProjectConfig<TSchemaId extends string> = {
    root: string
    targets: TargetsConfig<TSchemaId>
}

export type ProjectsConfig<TSchemaId extends string> = Readonly<Record<
    string,
    ProjectConfig<TSchemaId>
>>

export type Config<
    TSchemas extends SchemasConfig = SchemasConfig,
    TProjects extends ProjectsConfig<SchemaId<TSchemas>> = ProjectsConfig<SchemaId<TSchemas>>,
    TResolve extends ResolveConfig | undefined = ResolveConfig | undefined,
    TExecution extends ExecutionConfig | undefined = ExecutionConfig | undefined,
    TCache extends CacheConfig | undefined = CacheConfig | undefined,
    TLocks extends LocksConfig | undefined = LocksConfig | undefined,
> = {
    root: string
    schemas: TSchemas
    projects: TProjects
} & (TResolve extends ResolveConfig ? { resolve: TResolve } : { resolve?: undefined })
    & (TExecution extends ExecutionConfig ? { execution: TExecution } : { execution?: undefined })
    & (TCache extends CacheConfig ? { cache: TCache } : { cache?: undefined })
    & (TLocks extends LocksConfig ? { locks: TLocks } : { locks?: undefined })
