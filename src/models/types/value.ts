import type { ScalarUsage } from '../../scalars/types'
import type { SelectionModel } from './selection'
import type { TypeRef } from './type-ref'

import { VALUE_MODEL_KIND } from '../../kinds'

export type ScalarValue = {
    kind: typeof VALUE_MODEL_KIND.SCALAR;
    name: string;
    usage: ScalarUsage;
}

export type TypeNameValue = {
    kind: typeof VALUE_MODEL_KIND.TYPENAME;
    typeNames: string[];
}

export type EnumValue = {
    kind: typeof VALUE_MODEL_KIND.ENUM;
    name: string;
}

export type ObjectFieldValue = {
    kind: typeof VALUE_MODEL_KIND.OBJECT;
    fields: SelectionModel[];
    typeNames?: string[];
}

export type UnionVariant = {
    typeName: string;
    fields: SelectionModel[];
}

export type UnionFieldValue = {
    kind: typeof VALUE_MODEL_KIND.UNION;
    variants: UnionVariant[];
}

export type UnknownValue = {
    kind: typeof VALUE_MODEL_KIND.UNKNOWN;
    reason: string;
}

export type FieldValue =
    | ScalarValue
    | TypeNameValue
    | EnumValue
    | ObjectFieldValue
    | UnionFieldValue
    | UnknownValue

export type VariableField = {
    name: string;
    typeRef: TypeRef;
    value: VariableValue;
    optional?: boolean;
}

export type VariableObjectValue = {
    kind: typeof VALUE_MODEL_KIND.OBJECT;
    typeName?: string;
    fields: VariableField[];
    isRecursiveReference?: boolean;
}

export type VariableValue =
    | ScalarValue
    | EnumValue
    | VariableObjectValue
    | UnknownValue
