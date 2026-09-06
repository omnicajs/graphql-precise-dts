import type {
    DirectivePolicies,
    NamingPolicy,
    TypenamePolicy,
    ResolveConfig,
    ScalarMappings,
} from '@/config/types'

export type CodegenConfig = {
    root?: string
    typesModule: string
    enumsModule?: string
    scalars?: ScalarMappings
    directives?: DirectivePolicies
    naming?: NamingPolicy
    typename?: TypenamePolicy
    resolve?: ResolveConfig
}
