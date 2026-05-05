import type { OperationTypeNode } from 'graphql'
import type { SelectionModel } from './selection'
import type { UnionVariant, VariableField } from './value'

import { FRAGMENT_ROOT_KIND } from '../../kinds'

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
