import type {
    CompiledDefinition,
    CompiledDocument,
} from '../model'
import type { FragmentIndex } from './fragments'
import type {
    PlannedDefinition,
    PlannedDocument,
} from './types'
import type {
    GenerationDiagnostic,
    SchemaInput,
} from '../types'

import { CompilationError } from '../errors'
import { createNamingConvention } from '../naming'
import { planImports } from './imports'
import { planSelectionSet } from './selections'
import { validateSubscription } from './subscriptions'
import { validateNames } from './names'
import { validateOperationVariables } from './variables'

export type PlanResult =
    | { document: PlannedDocument }
    | { diagnostic: GenerationDiagnostic }

const planDefinition = (
    definition: CompiledDefinition,
    fragments: FragmentIndex
): PlannedDefinition => {
    if (definition.kind === 'operation') {
        validateOperationVariables(definition, fragments)
        const selectionSet = planSelectionSet(
            [ definition.rootType ],
            definition.selections,
            fragments
        )
        validateSubscription(definition, fragments)

        return {
            kind: 'operation',
            operation: definition.operation,
            name: definition.name,
            variables: definition.variables,
            location: definition.location,
            selectionSet,
        }
    }

    return {
        kind: 'fragment',
        name: definition.name,
        location: definition.location,
        selectionSet: planSelectionSet(
            definition.possibleTypes,
            definition.selections,
            fragments,
            [ definition ]
        ),
    }
}

const create = (
    document: CompiledDocument,
    fragments: FragmentIndex,
    schema: SchemaInput
): PlannedDocument => {
    const definitions = document.definitions.map(
        definition => planDefinition(definition, fragments)
    )
    const naming = createNamingConvention(schema.naming)
    const plannedDocument: PlannedDocument = {
        sourceId: document.sourceId,
        definitions,
        imports: planImports(document.sourceId, definitions, schema, naming),
    }

    validateNames(plannedDocument, naming)

    return plannedDocument
}

export const createPlan = (
    document: CompiledDocument,
    fragments: FragmentIndex,
    schema: SchemaInput
): PlanResult => {
    try {
        return { document: create(document, fragments, schema) }
    } catch (error) {
        /* v8 ignore next -- @preserve plan input is internal compiled IR; expected planning failures use CompilationError. */
        if (!(error instanceof CompilationError)) throw error

        return {
            diagnostic: {
                severity: 'error',
                code: error.code,
                sourceId: document.sourceId,
                location: error.location,
                message: error.message,
            },
        }
    }
}
