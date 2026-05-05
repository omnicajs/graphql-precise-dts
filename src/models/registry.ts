import type {
    EnumValueEntries,
    ScalarModelShape,
} from './types/type-ref'
import type {
    FragmentModel,
} from './types/document'

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
