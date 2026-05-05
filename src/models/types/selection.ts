import type { FieldValue } from './value'
import type { TypeRef } from './type-ref'

import { SELECTION_MODEL_KIND } from '../../kinds'

export type FieldSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FIELD;
    name: string;
    responseName: string;
    argumentsSignature: string;
    diagnosticLocation?: string;
    typeRef: TypeRef;
    value: FieldValue;
    conditional: boolean;
    directiveNames?: string[];
}

export type FragmentSpreadSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
    name: string;
    diagnosticLocation?: string;
    onType: string;
    onTypeNames?: string[];
    conditional: boolean;
    directiveNames?: string[];
}

export type FragmentInlineSelectionModel = {
    kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT;
    diagnosticLocation?: string;
    typeCondition?: string;
    selections: SelectionModel[];
    conditional: boolean;
    directiveNames?: string[];
}

export type SelectionModel = FieldSelectionModel | FragmentSpreadSelectionModel | FragmentInlineSelectionModel
