import type {
    CompiledOperation,
    CompiledSelection,
    CompiledVariableUsage,
} from '../model'
import type { FragmentIndex } from './fragments'

import { invalidDocument } from '../errors'
import { isVariableAllowed } from '../variables'
import {
    fragmentKey,
    resolve,
} from './fragments'

const collectUsages = (
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex,
    visitedFragments: ReadonlySet<string>
): ReadonlyArray<CompiledVariableUsage> => selections.flatMap(selection => {
    if (selection.kind === 'field' && selection.value.kind === 'composite') {
        return collectUsages(selection.value.selections, fragments, visitedFragments)
    }
    if (selection.kind === 'inline-fragment') {
        return collectUsages(selection.selections, fragments, visitedFragments)
    }
    if (selection.kind !== 'fragment-spread') return []

    const key = fragmentKey(selection.sourcePath, selection.name)
    if (visitedFragments.has(key)) return []

    const fragment = resolve(
        fragments,
        selection.sourcePath,
        selection.name,
        selection.location
    )
    const visited = new Set(visitedFragments).add(key)

    return [
        ...fragment.variableUsages,
        ...collectUsages(fragment.selections, fragments, visited),
    ]
})

const validateUsage = (
    operation: CompiledOperation,
    usage: CompiledVariableUsage
): void => {
    const variable = operation.variables.find(candidate => candidate.name === usage.name)
    if (!variable) {
        return invalidDocument(`Variable "$${usage.name}" is not defined`, usage.sourceLocation)
    }
    if (usage.requiresNonNullType && variable.type.kind !== 'non-null') {
        return invalidDocument(
            `Variable "$${usage.name}" must be non-nullable inside oneOf argument "${usage.argumentName}"`,
            usage.sourceLocation
        )
    }
    if (usage.location && !isVariableAllowed(variable, usage.location)) {
        return invalidDocument(
            `Variable "$${usage.name}" cannot be used for argument "${usage.argumentName}"`,
            usage.sourceLocation
        )
    }
}

export const validateOperationVariables = (
    operation: CompiledOperation,
    fragments: FragmentIndex
): void => {
    const usages = [
        ...operation.variableUsages,
        ...collectUsages(operation.selections, fragments, new Set()),
    ]

    usages.forEach(usage => validateUsage(operation, usage))

    const usedNames = new Set(usages.map(usage => usage.name))
    for (const variable of operation.variables) {
        if (!usedNames.has(variable.name)) {
            invalidDocument(
                `Variable "$${variable.name}" is never used in operation "${operation.name}"`,
                variable.location
            )
        }
    }
}
