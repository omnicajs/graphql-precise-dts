import type {
    GraphQLOutputType,
    SelectionNode,
} from 'graphql'

import { SELECTION_MODEL_KIND } from '../kinds'

export type TypeSelectionNode = TypeFieldNode | TypeFragmentSpreadNode | TypeFragmentInlineNode

export type TypeFieldNode = {
    kind: typeof SELECTION_MODEL_KIND.FIELD
    currentType: GraphQLOutputType;
    typeNames?: string[];
    selections?: WeakMap<SelectionNode, TypeSelectionNode>;
}

export type TypeFragmentSpreadNode = {
    kind: typeof SELECTION_MODEL_KIND.FRAGMENT_SPREAD;
    name: string;
}

export type TypeFragmentInlineNode = {
    kind: typeof SELECTION_MODEL_KIND.INLINE_FRAGMENT;
    typeCondition?: string;
    selections: WeakMap<SelectionNode, TypeSelectionNode>;
}
