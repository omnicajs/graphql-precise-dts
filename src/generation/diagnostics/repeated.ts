import type {
    DefinitionNode,
    SelectionNode,
    SelectionSetNode,
} from 'graphql'
import type {
    GenerationDiagnostic,
    ParsedDocumentSource,
    SourceLocation,
} from '../types'

import { getSourceLocation } from './location'
import { Kind } from 'graphql'

const formatLocation = (location: SourceLocation): string => `${location.line}:${location.column}`

const definitionLabel = (definition: DefinitionNode): string | undefined => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
        return `${definition.operation} "${definition.name?.value ?? 'unknown'}"`
    }
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        return `fragment "${definition.name.value}"`
    }
}

const nestedSelectionSet = (selection: SelectionNode): SelectionSetNode | undefined => (
    selection.kind === Kind.FIELD || selection.kind === Kind.INLINE_FRAGMENT
        ? selection.selectionSet
        : undefined
)

const collectSetWarnings = (
    selectionSet: SelectionSetNode,
    sourceId: string,
    owner: string
): ReadonlyArray<GenerationDiagnostic> => {
    const diagnostics: GenerationDiagnostic[] = []
    const fields = new Map<string, SourceLocation>()
    const spreads = new Map<string, SourceLocation>()

    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            const name = selection.alias?.value ?? selection.name.value
            const location = getSourceLocation(selection)!
            if (fields.has(name)) {
                diagnostics.push({
                    severity: 'warning',
                    code: 'repeated-field-selection',
                    sourceId,
                    location,
                    message: `Repeated field selection "${name}" in ${owner} was merged; first occurrence is at ${formatLocation(fields.get(name)!)}`,
                })
            } else {
                fields.set(name, location)
            }
        }
        if (selection.kind === Kind.FRAGMENT_SPREAD) {
            const name = selection.name.value
            const location = getSourceLocation(selection)!
            if (spreads.has(name)) {
                diagnostics.push({
                    severity: 'warning',
                    code: 'repeated-fragment-spread',
                    sourceId,
                    location,
                    message: `Repeated fragment spread "${name}" in ${owner} was merged; first occurrence is at ${formatLocation(spreads.get(name)!)}`,
                })
            } else {
                spreads.set(name, location)
            }
        }
    }

    for (const selection of selectionSet.selections) {
        const nested = nestedSelectionSet(selection)
        if (nested) diagnostics.push(...collectSetWarnings(nested, sourceId, owner))
    }

    return diagnostics
}

export const collectRepeatedSelectionDiagnostics = (
    source: ParsedDocumentSource
): ReadonlyArray<GenerationDiagnostic> => source.document.definitions.flatMap(definition => {
    const owner = definitionLabel(definition)
    if (!owner || !('selectionSet' in definition)) return []

    return collectSetWarnings(definition.selectionSet, source.id, owner)
})
