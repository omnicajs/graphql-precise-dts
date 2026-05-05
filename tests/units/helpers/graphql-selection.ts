import type { TypeSelectionNode } from '../../../src/models/selection'
import type {
    FragmentDefinitionNode,
    SelectionNode,
} from 'graphql'

export const getSelectionNode = (fragment: FragmentDefinitionNode, index: number): SelectionNode => {
    const selection = fragment.selectionSet.selections[index]

    if (!selection) throw new Error(`Selection at index ${index} not found`)

    return selection
}

export const getTypedSelection = (
    tree: WeakMap<SelectionNode, TypeSelectionNode>,
    selection: SelectionNode
): TypeSelectionNode => {
    const typedSelection = tree.get(selection)

    if (!typedSelection) throw new Error('Typed selection not found')

    return typedSelection
}
