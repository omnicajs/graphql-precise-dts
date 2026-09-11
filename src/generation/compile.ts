import type {
    FragmentDefinitionNode,
    OperationDefinitionNode,
} from 'graphql'
import type {
    CompilationContext,
    CompilationEnvironment,
} from './context'
import type {
    CompiledDefinition,
    CompiledDocument,
    CompiledFragment,
    CompiledOperation,
} from './model'
import type {
    GenerationDiagnostic,
    ParsedDocumentSource,
} from './types'
import type { VariableScope } from './variables'

import {
    CompilationError,
    invalidDocument,
    unsupportedDocument,
} from './errors'
import { getSelectionTypes } from './composites'
import { getSourceLocation } from './diagnostics/location'
import { validateDocumentImports } from './imports'
import { compileSelectionSet } from './selections'
import { Kind } from 'graphql'
import { collectRepeatedSelectionDiagnostics } from './diagnostics/repeated'
import { compileVariables } from './variables'
import { validateDirectives } from './directives'

export type CompileResult =
    | { document: CompiledDocument; diagnostics: ReadonlyArray<GenerationDiagnostic> }
    | { diagnostic: GenerationDiagnostic; diagnostics: ReadonlyArray<GenerationDiagnostic> }

const createEmptyVariableScope = (): VariableScope => ({
    variables: [],
    byName: new Map(),
    usages: [],
})

const compileOperation = (
    operation: OperationDefinitionNode,
    context: CompilationContext
): CompiledOperation => {
    if (!operation.name) return invalidDocument('Operation must have a name', operation)

    const rootType = context.schema.getRootType(operation.operation)
    if (!rootType) return invalidDocument(`Schema does not define a ${operation.operation} root type`, operation)

    const variables = compileVariables(operation.variableDefinitions!, context)
    validateDirectives(operation.directives!, operation.operation.toUpperCase(), context, variables)
    for (const definition of operation.variableDefinitions!) {
        validateDirectives(definition.directives!, 'VARIABLE_DEFINITION', context, variables)
    }

    return {
        kind: 'operation',
        operation: operation.operation,
        name: operation.name.value,
        rootType,
        variables: variables.variables,
        variableUsages: variables.usages,
        selections: compileSelectionSet(operation.selectionSet, rootType, variables, context),
        location: getSourceLocation(operation),
    }
}

const compileFragment = (
    fragment: FragmentDefinitionNode,
    context: CompilationContext
): CompiledFragment => {
    const type = fragment.typeCondition.name.value
    const variables = createEmptyVariableScope()
    validateDirectives(fragment.directives!, 'FRAGMENT_DEFINITION', context, variables)

    return {
        kind: 'fragment',
        sourceId: context.sourceId,
        sourcePath: context.sourcePath,
        name: fragment.name.value,
        type,
        possibleTypes: getSelectionTypes(type, context.schema, fragment),
        variableUsages: variables.usages,
        selections: compileSelectionSet(fragment.selectionSet, type, variables, context),
        location: getSourceLocation(fragment),
    }
}

const compileDefinition = (
    definition: ParsedDocumentSource['document']['definitions'][number],
    context: CompilationContext
): CompiledDefinition => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
        return compileOperation(definition, context)
    }
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
        return compileFragment(definition, context)
    }

    return unsupportedDocument(`Definition of kind "${definition.kind}" is not executable`, definition)
}

const compile = (
    source: ParsedDocumentSource,
    context: CompilationContext
): CompiledDocument => {
    validateDocumentImports(source, context.sources)
    const definitions = source.document.definitions.map(
        definition => compileDefinition(definition, context)
    )
    const operationNames = new Set<string>()
    const fragmentNames = new Set<string>()

    for (const [ index, definition ] of definitions.entries()) {
        const names = definition.kind === 'operation' ? operationNames : fragmentNames
        if (names.has(definition.name)) {
            return invalidDocument(
                `Definition "${definition.name}" is declared more than once in the document`,
                source.document.definitions[index]
            )
        }
        names.add(definition.name)
    }

    return {
        sourceId: source.id,
        definitions,
    }
}

export const compileDocument = (
    source: ParsedDocumentSource,
    environment: CompilationEnvironment
): CompileResult => {
    const diagnostics: GenerationDiagnostic[] = [ ...collectRepeatedSelectionDiagnostics(source) ]
    const context: CompilationContext = {
        ...environment,
        sourceId: source.id,
        sourcePath: source.path,
        reportDiagnostic: diagnostic => diagnostics.push(diagnostic),
    }

    try {
        return { document: compile(source, context), diagnostics }
    } catch (error) {
        /* v8 ignore next -- @preserve non-compilation faults are internal failures, not public inputs. */
        if (!(error instanceof CompilationError)) throw error

        return {
            diagnostics,
            diagnostic: {
                severity: 'error',
                code: error.code,
                sourceId: source.id,
                location: error.location,
                message: error.message,
            },
        }
    }
}
