import {
    ConfigDirectivePolicies,
    ConfigScalars,
} from '../config'
import type { FragmentDefinitionNode } from 'graphql/index'
import type { OperationTypeNode } from 'graphql'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ScalarShape } from '../scalars/types'
import type { TsTypeString } from '../config'
import type { TypeRefKind } from './kinds'

import {
    FragmentRootKind,
    SelectionModelKind,
    ValueModelKind,
} from './kinds'

export type ModelContext = {
    schema: Parameters<PluginFunction<PluginConfig>>[0];
    fragmentDefinitions: Map<string, FragmentDefinitionNode>;
    customScalars: ConfigScalars;
    directivePolicies: ConfigDirectivePolicies;
}

export type TypeRef =
    | { kind: TypeRefKind.NAMED; name: string }
    | { kind: TypeRefKind.LIST; ofType: TypeRef }
    | { kind: TypeRefKind.NON_NULL; ofType: TypeRef }

export type FieldValue =
    | { kind: ValueModelKind.SCALAR; typeTs: string }
    | { kind: ValueModelKind.TYPENAME; typeNames: string[] }
    | { kind: ValueModelKind.ENUM; name: string }
    | {
        kind: ValueModelKind.OBJECT;
        fields: SelectionModel[];
        typeNames?: string[];
}
    | {
        kind: ValueModelKind.UNION;
        variants: Array<{ typeName: string; fields: SelectionModel[] }>;
    }
    | { kind: ValueModelKind.UNKNOWN; reason: string }

export type InputValue =
    | { kind: ValueModelKind.SCALAR; typeTs: string }
    | { kind: ValueModelKind.ENUM; name: string }
    | { kind: ValueModelKind.OBJECT; fields: InputField[] }
    | { kind: ValueModelKind.UNKNOWN; reason: string }

export type NamedTypedNode<TValue> = {
    name: string;
    typeRef: TypeRef;
    value: TValue;
}

export type FieldSelectionModel = NamedTypedNode<FieldValue> & {
    kind: SelectionModelKind.FIELD;
    responseName: string;
    conditional?: boolean;
    overrideTypeTs?: string;
    directives?: string[];
}
export type FragmentSpreadSelectionModel = {
    kind: SelectionModelKind.FRAGMENT_SPREAD;
    name: string;
    onType: string;
    onTypeNames?: string[];
    conditional?: boolean;
    directives?: string[];
}
export type FragmentInlineSelectionModel = {
    kind: SelectionModelKind.INLINE_FRAGMENT;
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
    kind: FragmentRootKind.OBJECT;
    fields: SelectionModel[];
} | {
    kind: FragmentRootKind.UNION;
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
