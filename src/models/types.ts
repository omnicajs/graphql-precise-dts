import {
    ConfigDirectivePolicies,
    ConfigScalars,
} from '../config'
import type { FragmentDefinitionNode } from 'graphql'
import type { OperationTypeNode } from 'graphql'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ScalarShape } from '../scalars/types'
import type { TsTypeString } from '../config'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from './kinds'

export type ModelContext = {
    schema: Parameters<PluginFunction<PluginConfig>>[0];
    fragmentDefinitions: Map<string, FragmentDefinitionNode>;
    customScalars: ConfigScalars;
    directivePolicies: ConfigDirectivePolicies;
}

export type TypeRef =
    | { kind: typeof TYPE_REF_KIND.NAMED; name: string }
    | { kind: typeof TYPE_REF_KIND.LIST; ofType: TypeRef }
    | { kind: typeof TYPE_REF_KIND.NON_NULL; ofType: TypeRef }

export type FieldValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: string }
    | { kind: typeof VALUE_MODEL_KIND.TYPENAME; typeNames: string[] }
    | { kind: typeof VALUE_MODEL_KIND.ENUM; name: string }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        fields: SelectionModel[];
        typeNames?: string[];
}
    | {
        kind: typeof VALUE_MODEL_KIND.UNION;
        variants: Array<{ typeName: string; fields: SelectionModel[] }>;
    }
    | { kind: typeof VALUE_MODEL_KIND.UNKNOWN; reason: string }

export type InputValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: string }
    | { kind: typeof VALUE_MODEL_KIND.ENUM; name: string }
    | { kind: typeof VALUE_MODEL_KIND.OBJECT; fields: InputField[] }
    | { kind: typeof VALUE_MODEL_KIND.UNKNOWN; reason: string }

export type NamedTypedNode<TValue> = {
    name: string;
    typeRef: TypeRef;
    value: TValue;
}

export type FieldSelectionModel = NamedTypedNode<FieldValue> & {
    kind: typeof SELECTION_MODEL_KIND.FIELD;
    responseName: string;
    conditional?: boolean;
    overrideTypeTs?: string;
    directives?: string[];
}
export type FragmentSpreadSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
    name: string;
    onType: string;
    onTypeNames?: string[];
    conditional?: boolean;
    directives?: string[];
}
export type FragmentInlineSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT;
    typeCondition?: string;
    selections: SelectionModel[];
    conditional?: boolean;
    directives?: string[];
}

export type SelectionModel = FieldSelectionModel | FragmentSpreadSelectionModel | FragmentInlineSelectionModel

export type EnumValueEntries = { name: string; value: string }[]
export type ScalarModelShape = ScalarShape<TsTypeString, TsTypeString>

export type InputField = NamedTypedNode<InputValue> & {
    optional?: boolean;
}

export type FragmentRoot = {
    kind: typeof FRAGMENT_ROOT_KIND.OBJECT;
    fields: SelectionModel[];
} | {
    kind: typeof FRAGMENT_ROOT_KIND.UNION;
    variants: Array<{
        typeName: string;
        fields: SelectionModel[];
    }>;
}

export type FragmentModel = {
    onType: string;
    onTypeNames?: string[];
    root: FragmentRoot;
}

export type OperationModel = {
    operationType: OperationTypeNode;
    onType: string;
    variables: InputField[];
    result: SelectionModel[];
}

export type DocumentModels = {
    fragments: Map<string, FragmentModel>;
    operations: Map<string, OperationModel>;
}
