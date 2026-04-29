import type {
    ConfigDirectivePolicies,
    ConfigScalars,
} from '../config'
import type {
    FragmentDefinitionNode,
    OperationTypeNode,
} from 'graphql'
import type { ScalarShape } from '../scalars/types'
import type { Schema } from '../config'
import type { Source } from 'graphql'
import type { TsType } from '../ts-type'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
    VALUE_MODEL_KIND,
} from './kinds'

export type ModelContext = {
    schema: Schema;
    fragmentDefinitions: Map<string, FragmentDefinitionNode>;
    documentLocations: WeakMap<Source, string>;
    customScalars: ConfigScalars;
    directivePolicies: ConfigDirectivePolicies;
}

export type TypeRef =
    | { kind: typeof TYPE_REF_KIND.NAMED; name: string }
    | { kind: typeof TYPE_REF_KIND.LIST; ofType: TypeRef }
    | { kind: typeof TYPE_REF_KIND.NON_NULL; ofType: TypeRef }

export type FieldValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: TsType }
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

export type VariableValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: TsType }
    | { kind: typeof VALUE_MODEL_KIND.ENUM; name: string }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        typeName?: string;
        fields: VariableField[];
        isRecursiveReference?: boolean;
    }
    | { kind: typeof VALUE_MODEL_KIND.UNKNOWN; reason: string }

export type NamedTypedNode<TValue> = {
    name: string;
    typeRef: TypeRef;
    value: TValue;
}

export type FieldSelectionModel = NamedTypedNode<FieldValue> & {
    kind: typeof SELECTION_MODEL_KIND.FIELD;
    responseName: string;
    argumentsSignature: string;
    diagnosticLocation?: string;
    conditional: boolean;
    overrideTypeTs?: TsType;
    directives?: string[];
}
export type FragmentSpreadSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
    name: string;
    diagnosticLocation?: string;
    onType: string;
    onTypeNames?: string[];
    conditional: boolean;
    directives?: string[];
}
export type FragmentInlineSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT;
    diagnosticLocation?: string;
    typeCondition?: string;
    selections: SelectionModel[];
    conditional: boolean;
    directives?: string[];
}

export type SelectionModel = FieldSelectionModel | FragmentSpreadSelectionModel | FragmentInlineSelectionModel

export type EnumValueEntries = { name: string; value: string }[]
export type ScalarModelShape = ScalarShape<string, string>

export type VariableField = NamedTypedNode<VariableValue> & {
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
    variables: VariableField[];
    result: SelectionModel[];
}

export type CollectedDocumentModels = {
    fragments: Map<string, FragmentModel>;
    operations: Map<string, OperationModel>;
}
