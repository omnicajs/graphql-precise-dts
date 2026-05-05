import type { FragmentModel } from './types/document'

import type {
    EnumValueEntries,
    ScalarModelShape,
} from './types/type-ref'

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
