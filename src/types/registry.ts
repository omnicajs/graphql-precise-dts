import type {
    EnumDefinitionModel,
    FragmentModel,
    ScalarModel,
} from './models'

export type DefRegistry = {
    scalars: Map<string, ScalarModel>;
    enums: Map<string, EnumDefinitionModel>;
    fragments: Map<string, FragmentModel>;
}
