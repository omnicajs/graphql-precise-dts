import type { TsType } from '../ts-type'

export type ScalarUsage = 'input' | 'output'

export type ScalarShape<TInput, TOutput = TInput> = { input: TInput; output: TOutput }

export type CustomScalarMapping = TsType | Partial<ScalarShape<TsType, TsType>>
export type CustomScalarMappingRecord = Record<string, CustomScalarMapping>

export type Scalars = {
    ID: ScalarShape<string>;
    String: ScalarShape<string>;
    Boolean: ScalarShape<boolean>;
    Int: ScalarShape<number>;
    Float: ScalarShape<number>;
}

export type ScalarPrimitiveMap = {
    ID: 'string';
    String: 'string';
    Boolean: 'boolean';
    Int: 'number';
    Float: 'number';
}
