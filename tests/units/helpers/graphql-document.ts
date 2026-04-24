import type { FragmentDefinitionNode } from 'graphql'

import { parse } from 'graphql'

export const getFragmentDefinition = (source: string): FragmentDefinitionNode => {
    const document = parse(source)
    const fragment = document.definitions.find(
        definition => definition.kind === 'FragmentDefinition'
    )

    if (!fragment || fragment.kind !== 'FragmentDefinition') {
        throw new Error('Fragment definition not found')
    }

    return fragment
}

export const getOperationDefinition = (source: string) => {
    const document = parse(source)
    const definition = document.definitions.find(
        item => item.kind === 'OperationDefinition'
    )

    if (!definition || definition.kind !== 'OperationDefinition') {
        throw new Error('Operation definition not found')
    }

    return definition
}

export const getDocumentFragmentDefinition = (source: string, name: string) => {
    const document = parse(source)
    const definition = document.definitions.find(item =>
        item.kind === 'FragmentDefinition' && item.name.value === name
    )

    if (!definition || definition.kind !== 'FragmentDefinition') {
        throw new Error('Fragment definition not found')
    }

    return {
        document,
        definition,
    }
}
