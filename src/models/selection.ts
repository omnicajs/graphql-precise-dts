import type { GraphQLOutputType, SelectionNode } from 'graphql'

import { SelectionModelKind } from './kinds'

export type TypeSelectionNode = TypeFieldNode | TypeFragmentSpreadNode | TypeFragmentInlineNode

export type TypeFieldNode = {
    kind: SelectionModelKind.FIELD
    currentType: GraphQLOutputType;
    typeNames?: string[];
    selections?: WeakMap<SelectionNode, TypeSelectionNode>;
}

export type TypeFragmentSpreadNode = {
    kind: SelectionModelKind.FRAGMENT_SPREAD;
    name: string;
}

export type TypeFragmentInlineNode = {
    kind: SelectionModelKind.INLINE_FRAGMENT;
    typeCondition?: string;
    selections?: WeakMap<SelectionNode, TypeSelectionNode>;
}
