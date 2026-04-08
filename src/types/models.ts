import type {
    ConfigDirectivePolicies,
    ConfigScalar,
} from '../config'
import type { FragmentDefinitionNode } from 'graphql/index'
import type { OperationTypeNode } from 'graphql'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { ScalarShape } from './scalars'
import type { ScalarTsType } from '../config'
import type { TypeRefKind } from '../enums/model-kinds'

import {
    DefinitionNodeKind,
    FieldValueKind,
    FragmentRootKind,
} from '../enums/model-kinds'

export type ModelContext = {
    schema: Parameters<PluginFunction<PluginConfig>>[0];
    fragmentsDefs: Map<string, FragmentDefinitionNode>;
    customScalars: ConfigScalar;
    directivePolicies: ConfigDirectivePolicies;
}

export type TypeRef =
    | { kind: TypeRefKind.NAMED; name: string }
    | { kind: TypeRefKind.LIST; ofType: TypeRef }
    | { kind: TypeRefKind.NON_NULL; ofType: TypeRef }

export type FieldValueModel =
    | { kind: FieldValueKind.SCALAR; typeTs: string }
    | { kind: FieldValueKind.TYPENAME; typeNames: string[] }
    | { kind: FieldValueKind.ENUM; name: string }
    | {
        kind: FieldValueKind.OBJECT;
        fields: DefinitionNodeModel[];
        typeNames?: string[];
}
    | {
        kind: FieldValueKind.UNION;
        variants: Array<{ typeName: string; fields: DefinitionNodeModel[] }>;
    }
    | { kind: FieldValueKind.UNKNOWN; reason: string }

export type InputValueModel =
    | { kind: FieldValueKind.SCALAR; typeTs: string }
    | { kind: FieldValueKind.ENUM; name: string }
    | { kind: FieldValueKind.OBJECT; fields: InputFieldModel[] }
    | { kind: FieldValueKind.UNKNOWN; reason: string }

export type NamedTypedNode<TValue> = {
    name: string;
    typeRef: TypeRef;
    value: TValue;
}

export type FieldNodeModel = NamedTypedNode<FieldValueModel> & {
    kind: DefinitionNodeKind.FIELD;
    responseName: string;
    conditional?: boolean;
    overrideTypeTs?: string;
    directives?: string[];
}
export type FragmentSpreadModel = {
    kind: DefinitionNodeKind.FRAGMENT_SPREAD;
    name: string;
    onType: string;
    onTypeNames?: string[];
    conditional?: boolean;
    directives?: string[];
}
export type FragmentInlineModel = {
    kind: DefinitionNodeKind.INLINE_FRAGMENT;
    typeCondition?: string;
    selections: DefinitionNodeModel[];
    conditional?: boolean;
    directives?: string[];
}

export type DefinitionNodeModel = FieldNodeModel | FragmentSpreadModel | FragmentInlineModel

export type EnumDefinitionModel = { name: string; value: string }[]
export type ScalarModel = ScalarShape<ScalarTsType, ScalarTsType>

export type InputFieldModel = NamedTypedNode<InputValueModel>

export type FragmentRootModel = {
    kind: FragmentRootKind.OBJECT;
    fields: DefinitionNodeModel[];
} | {
    kind: FragmentRootKind.UNION;
    variants: Array<{
        typeName: string;
        fields: DefinitionNodeModel[];
    }>;
}

export type FragmentModel = {
    onType: string;
    onTypeNames?: string[];
    root: FragmentRootModel;
}

export type OperationModel = {
    operationType: OperationTypeNode;
    onType: string;
    variables: InputFieldModel[];
    result: DefinitionNodeModel[];
}

export type DeclarationDefinitions = {
    fragments: Map<string, FragmentModel>;
    operations: Map<string, OperationModel>;
}
