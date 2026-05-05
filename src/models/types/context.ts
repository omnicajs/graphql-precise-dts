import type {
    FragmentDefinitionNode,
    Source,
} from 'graphql'
import type { Schema } from '../../plugin-types'
import type { StructuralDirectivePolicies } from '../../directives/types'

export type ModelContext = {
    schema: Schema;
    fragmentDefinitions: Map<string, FragmentDefinitionNode>;
    documentLocations: WeakMap<Source, string>;
    structuralDirectivePolicies: StructuralDirectivePolicies;
}
