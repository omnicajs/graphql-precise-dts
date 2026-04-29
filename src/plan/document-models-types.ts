import type {
    FieldSelectionModel,
    FieldValue,
    FragmentInlineSelectionModel,
    FragmentModel,
    FragmentSpreadSelectionModel,
    OperationModel,
    VariableField,
    VariableValue,
} from '../models/types'

import { FRAGMENT_ROOT_KIND, VALUE_MODEL_KIND } from '../models/kinds'

export type ObjectRenderOptions = {
    requiredFallbackTypename?: boolean;
    dedupeTypenameWithSpread?: boolean;
    dedupeTypenameWithAlias?: boolean;
}

export type DocumentUnionVariant = {
    typeName: string;
    fields: DocumentSelectionModel[];
}

export type DocumentObjectFieldValue = Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }> & {
    fields: DocumentSelectionModel[];
    renderAliasName?: string;
    renderAsReference?: boolean;
    renderOptions: ObjectRenderOptions;
}

export type DocumentFieldValue =
    | Exclude<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT | typeof VALUE_MODEL_KIND.UNION }>
    | DocumentObjectFieldValue
    | {
        kind: typeof VALUE_MODEL_KIND.UNION;
        variants: DocumentUnionVariant[];
    }

export type DocumentFieldSelectionModel = Omit<FieldSelectionModel, 'value'> & {
    value: DocumentFieldValue;
}

export type DocumentFragmentSpreadSelectionModel = FragmentSpreadSelectionModel

export type DocumentFragmentInlineSelectionModel = Omit<FragmentInlineSelectionModel, 'selections'> & {
    selections: DocumentSelectionModel[];
}

export type DocumentSelectionModel =
    | DocumentFieldSelectionModel
    | DocumentFragmentSpreadSelectionModel
    | DocumentFragmentInlineSelectionModel

export type DocumentFragmentRoot = {
    kind: typeof FRAGMENT_ROOT_KIND.OBJECT;
    fields: DocumentSelectionModel[];
} | {
    kind: typeof FRAGMENT_ROOT_KIND.UNION;
    variants: DocumentUnionVariant[];
}

export type DocumentFragmentModel = Omit<FragmentModel, 'root'> & {
    root: DocumentFragmentRoot;
}

export type DocumentVariableObjectValue = Omit<
    Extract<VariableValue,
    { kind: typeof VALUE_MODEL_KIND.OBJECT }>, 'fields' | 'isRecursiveReference'
> & {
    fields: DocumentVariableField[];
    renderAliasName?: string;
    renderAsReference?: boolean;
}

export type DocumentVariableValue =
    | Exclude<VariableValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>
    | DocumentVariableObjectValue

export type DocumentVariableField = Omit<VariableField, 'value'> & {
    value: DocumentVariableValue;
}

export type DocumentOperationModel = Omit<OperationModel, 'result' | 'variables'> & {
    result: DocumentSelectionModel[];
    variables: DocumentVariableField[];
}

export type DocumentOutputAlias = {
    aliasName: string;
    typeNames: string[];
    fields: DocumentSelectionModel[];
    renderOptions: ObjectRenderOptions;
}

export type DocumentVariableAlias = {
    typeName: string;
    aliasName: string;
    fields: DocumentVariableField[];
}

export type DocumentModels = {
    fragments: Map<string, DocumentFragmentModel>;
    operations: Map<string, DocumentOperationModel>;
    variableAliases: DocumentVariableAlias[];
    outputAliases: DocumentOutputAlias[];
}

export type OutputObjectOccurrence = {
    count: number;
    recursive: boolean;
    suggestedAliasName: string;
    nodes: DocumentObjectFieldValue[];
}

export type OutputBuildState = {
    occurrences: Map<string, OutputObjectOccurrence>;
    inProgressSignatures: Set<string>;
    inProgressObjectNodes: WeakMap<Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>, DocumentObjectFieldValue>;
}
