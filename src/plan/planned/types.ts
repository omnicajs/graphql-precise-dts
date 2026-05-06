import type { OperationTypeNode } from 'graphql'
import type { TsType } from '../../ts-type'
import type {
    FieldValue,
    TypeRef,
} from '../../models/types'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../../kinds'

export type ObjectRenderOptions = {
    requiredFallbackTypename?: boolean;
    dedupeTypenameWithSpread?: boolean;
    dedupeTypenameWithAlias?: boolean;
}

export type PlannedScalarValue = {
    kind: typeof VALUE_MODEL_KIND.SCALAR;
    typeTs: TsType;
}

export type PlannedTypeNameValue = {
    kind: typeof VALUE_MODEL_KIND.TYPENAME;
    typeNames: string[];
}

export type PlannedEnumValue = {
    kind: typeof VALUE_MODEL_KIND.ENUM;
    name: string;
}

export type PlannedUnknownValue = {
    kind: typeof VALUE_MODEL_KIND.UNKNOWN;
    reason: string;
}

export type PlannedObjectFieldValue = {
    kind: typeof VALUE_MODEL_KIND.OBJECT;
    fields: PlannedSelectionModel[];
    typeNames?: string[];
    renderAliasName?: string;
    renderAsReference?: boolean;
    renderOptions: ObjectRenderOptions;
}

export type PlannedUnionFieldValue = {
    kind: typeof VALUE_MODEL_KIND.UNION;
    variants: PlannedUnionVariant[];
}

export type PlannedFieldValue =
    | PlannedScalarValue
    | PlannedTypeNameValue
    | PlannedEnumValue
    | PlannedUnknownValue
    | PlannedObjectFieldValue
    | PlannedUnionFieldValue

export type PlannedVariableField = {
    name: string;
    typeRef: TypeRef;
    value: PlannedVariableValue;
    optional?: boolean;
}

export type PlannedVariableObjectValue = {
    kind: typeof VALUE_MODEL_KIND.OBJECT;
    typeName?: string;
    fields: PlannedVariableField[];
    renderAliasName?: string;
    renderAsReference?: boolean;
}

export type PlannedVariableValue =
    | PlannedScalarValue
    | PlannedEnumValue
    | PlannedUnknownValue
    | PlannedVariableObjectValue

export type PlannedFieldSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FIELD;
    name: string;
    responseName: string;
    argumentsSignature: string;
    diagnosticLocation?: string;
    typeRef: TypeRef;
    value: PlannedFieldValue;
    conditional: boolean;
    overrideTypeTs?: TsType;
    directives?: string[];
}

export type PlannedFragmentSpreadSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
    name: string;
    diagnosticLocation?: string;
    onType: string;
    onTypeNames?: string[];
    conditional: boolean;
    directives?: string[];
}

export type PlannedSelectionModel =
    | PlannedFieldSelectionModel
    | PlannedFragmentSpreadSelectionModel

export type PlannedUnionVariant = {
    typeName: string;
    fields: PlannedSelectionModel[];
}

export type PlannedFragmentRoot = {
    kind: typeof FRAGMENT_ROOT_KIND.OBJECT;
    fields: PlannedSelectionModel[];
} | {
    kind: typeof FRAGMENT_ROOT_KIND.UNION;
    variants: PlannedUnionVariant[];
}

export type PlannedFragmentModel = {
    onType: string;
    onTypeNames?: string[];
    root: PlannedFragmentRoot;
}

export type PlannedOperationModel = {
    operationType: OperationTypeNode;
    onType: string;
    result: PlannedSelectionModel[];
    variables: PlannedVariableField[];
}

export type PlannedOutputAlias = {
    aliasName: string;
    typeNames: string[];
    fields: PlannedSelectionModel[];
    renderOptions: ObjectRenderOptions;
}

export type PlannedDocumentModels = {
    fragments: Map<string, PlannedFragmentModel>;
    operations: Map<string, PlannedOperationModel>;
    variableAliases: PlannedVariableAlias[];
    outputAliases: PlannedOutputAlias[];
}

export type PlannedVariableAlias = {
    typeName: string;
    aliasName: string;
    fields: PlannedVariableField[];
}

export type OutputObjectOccurrence = {
    count: number;
    recursive: boolean;
    suggestedAliasName: string;
    nodes: PlannedObjectFieldValue[];
}

export type OutputBuildState = {
    occurrences: Map<string, OutputObjectOccurrence>;
    inProgressSignatures: Set<string>;
    inProgressObjectNodes: WeakMap<
        Extract<FieldValue, { kind: typeof VALUE_MODEL_KIND.OBJECT }>,
        PlannedObjectFieldValue
    >;
}
