import type { GraphQLOutputType, SelectionNode } from 'graphql'

import { DefinitionNodeKind } from '../enums/model-kinds'

export type TypeSelectionNode = TypeFieldNode | TypeFragmentSpreadNode | TypeFragmentInlineNode

export type TypeFieldNode = {
    kind: DefinitionNodeKind.FIELD
    currentType: GraphQLOutputType;
    typeNames?: string[];
    selections?: WeakMap<SelectionNode, TypeSelectionNode>;
}

export type TypeFragmentSpreadNode = {
    kind: DefinitionNodeKind.FRAGMENT_SPREAD;
    name: string;
}

export type TypeFragmentInlineNode = {
    kind: DefinitionNodeKind.INLINE_FRAGMENT;
    typeCondition?: string;
    selections?: WeakMap<SelectionNode, TypeSelectionNode>;
}
