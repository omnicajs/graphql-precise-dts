import type { FragmentModel } from './types/document'

import type {
    EnumValueEntries,
    ScalarModelShape,
} from './types/type-ref'

export type SchemaOutputModel = {
    scalars: Map<string, ScalarModelShape>;
}

export type ReusableModelRegistry = {
    enums: Map<string, EnumValueEntries>;
    fragments: Map<string, FragmentModel>;
}

export type GenerationModels = {
    schema: SchemaOutputModel;
    registry: ReusableModelRegistry;
}
