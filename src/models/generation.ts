import type { EnumModel } from './types/type-ref'
import type { FragmentModel } from './types/document'
import type { ScalarModelShape } from './types/type-ref'
import type { TsType } from '../ts-type'

export type SchemaObjectModel = {
    fields: TsType;
    interfaces: string[];
    description?: string;
}

export type SchemaFieldArgTypeModel = {
    parentTypeName: string;
    fieldName: string;
    type: TsType;
}

export type SchemaOutputModel = {
    enumReferences: Set<string>;
    scalars: Map<string, ScalarModelShape>;
    inputTypes: Map<string, TsType>;
    interfaceTypes: Map<string, TsType>;
    objectTypes: Map<string, SchemaObjectModel>;
    unionTypes: Map<string, TsType>;
    fieldArgTypes: SchemaFieldArgTypeModel[];
}

export type ReusableModelRegistry = {
    enums: Map<string, EnumModel>;
    fragments: Map<string, FragmentModel>;
}

export type GenerationModels = {
    schema: SchemaOutputModel;
    registry: ReusableModelRegistry;
}
