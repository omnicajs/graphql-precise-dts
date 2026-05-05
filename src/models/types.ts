import type {
    FragmentDefinitionNode,
    OperationTypeNode,
} from 'graphql'
import type {
    ScalarShape,
    ScalarUsage,
} from '../scalars/types'
import type { Schema } from '../plugin-types'
import type { Source } from 'graphql'
import type { StructuralDirectivePolicies } from '../directives/policy'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from '../kinds'

export type ModelContext = {
    schema: Schema;
    fragmentDefinitions: Map<string, FragmentDefinitionNode>;
    documentLocations: WeakMap<Source, string>;
    structuralDirectivePolicies: StructuralDirectivePolicies;
}

export type TypeRef =
    | { kind: typeof TYPE_REF_KIND.NAMED; name: string }
    | { kind: typeof TYPE_REF_KIND.LIST; ofType: TypeRef }
    | { kind: typeof TYPE_REF_KIND.NON_NULL; ofType: TypeRef }

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

export type FieldSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FIELD;
    name: string;
    responseName: string;
    argumentsSignature: string;
    diagnosticLocation?: string;
    typeRef: TypeRef;
    value: FieldValue;
    conditional: boolean;
    directives?: string[];
    directiveNames?: string[];
}

export type FragmentSpreadSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
    name: string;
    diagnosticLocation?: string;
    onType: string;
    onTypeNames?: string[];
    conditional: boolean;
    directives?: string[];
    directiveNames?: string[];
}
export type FragmentInlineSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT;
    diagnosticLocation?: string;
    typeCondition?: string;
    selections: SelectionModel[];
    conditional: boolean;
    directives?: string[];
    directiveNames?: string[];
}

export type SelectionModel = FieldSelectionModel | FragmentSpreadSelectionModel | FragmentInlineSelectionModel

export type EnumValueEntries = { name: string; value: string }[]
export type ScalarModelShape = ScalarShape<string, string>

export type VariableField = {
    name: string;
    typeRef: TypeRef;
    value: VariableValue;
    optional?: boolean;
}

export type FragmentRoot = {
    kind: typeof FRAGMENT_ROOT_KIND.OBJECT;
    fields: SelectionModel[];
} | {
    kind: typeof FRAGMENT_ROOT_KIND.UNION;
    variants: UnionVariant[];
}

export type FragmentModel = {
    onType: string;
    onTypeNames?: string[];
    root: FragmentRoot;
}

export type OperationModel = {
    operationType: OperationTypeNode;
    onType: string;
    variables: VariableField[];
    result: SelectionModel[];
}

export type CollectedDocumentModels = {
    fragments: Map<string, FragmentModel>;
    operations: Map<string, OperationModel>;
}
