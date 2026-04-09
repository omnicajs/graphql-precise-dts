import type {
    EnumValueEntries,
    FragmentModel,
    ScalarModelShape,
} from './types'

export type ModelSchemaRegistry = {
    scalars: Map<string, ScalarModelShape>;
    enums: Map<string, EnumValueEntries>;
}

export type ModelRegistry = {
    schema: ModelSchemaRegistry;
    documents: {
        fragments: Map<string, FragmentModel>;
    };
}
