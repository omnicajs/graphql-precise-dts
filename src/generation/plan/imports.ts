import type { CompiledInputValue } from '../model'
import type { NamingConvention } from '../naming'
import type {
    PlannedDefinition,
    PlannedSelection,
    PlannedSelectionSet,
    PlannedTypeImport,
} from './types'
import type { SchemaInput } from '../types'
import type { SourceLocation } from '../types'

type ImportEntry = {
    names: Set<string>
    location: SourceLocation
}

const addImport = (
    imports: Map<string, ImportEntry>,
    source: string,
    name: string,
    location: SourceLocation
): void => {
    const entry = imports.get(source) ?? {
        names: new Set<string>(),
        location,
    }
    entry.names.add(name)
    imports.set(source, entry)
}

const visitInputValue = (
    value: CompiledInputValue,
    visitEnum: (type: string) => void,
    visitInputReference: (type: string) => void
): void => {
    if (value.kind === 'enum') {
        visitEnum(value.type)
        return
    }
    if (value.kind === 'input-reference') {
        visitInputReference(value.type)
        return
    }
    if (value.kind === 'input-object') {
        value.fields.forEach(field => visitInputValue(field.value, visitEnum, visitInputReference))
    }
}

const visitSelections = (
    selectionSet: PlannedSelectionSet,
    visit: (selection: PlannedSelection) => void
): void => {
    for (const variant of selectionSet.variants) {
        for (const selection of variant.selections) {
            visit(selection)
            if (selection.kind === 'field' && selection.value.kind === 'composite') {
                visitSelections(selection.value.selectionSet, visit)
            }
        }
    }
}

export const planImports = (
    sourceId: string,
    definitions: ReadonlyArray<PlannedDefinition>,
    schema: SchemaInput,
    naming: NamingConvention
): ReadonlyArray<PlannedTypeImport> => {
    const imports = new Map<string, ImportEntry>()
    const dependencyImports = new Map<string, ImportEntry>()
    const operations = definitions.filter(definition => definition.kind === 'operation')
    const enumsModule = schema.enumsModule ?? schema.typesModule

    if (operations.some(operation => operation.variables.length > 0)) {
        addImport(imports, schema.typesModule, 'Exact', operations[0].location)
    }
    if (operations.length) {
        addImport(
            imports,
            '@graphql-typed-document-node/core',
            'TypedDocumentNode',
            operations[0].location
        )
    }

    for (const definition of definitions) {
        const addEnum = (type: string): void => addImport(
            dependencyImports,
            enumsModule,
            naming.typeName(type),
            definition.location
        )
        const addInputReference = (type: string): void => addImport(
            dependencyImports,
            schema.typesModule,
            naming.typeName(type),
            definition.location
        )

        if (definition.kind === 'operation') {
            definition.variables.forEach(variable => visitInputValue(
                variable.value,
                addEnum,
                addInputReference
            ))
        }

        visitSelections(definition.selectionSet, selection => {
            if (selection.kind === 'fragment-spread' && selection.sourceId !== sourceId) {
                addImport(
                    dependencyImports,
                    selection.sourceId,
                    naming.fragmentName(selection.name),
                    definition.location
                )
            }
            if (selection.kind === 'field' && selection.value.kind === 'enum') {
                addEnum(selection.value.type)
            }
        })
    }

    for (const [ source, entry ] of [ ...dependencyImports ].sort(
        ([ left ], [ right ]) => left.localeCompare(right)
    )) {
        entry.names.forEach(name => addImport(imports, source, name, entry.location))
    }

    return [ ...imports ].map(([ source, entry ]) => ({
        source,
        names: [ ...entry.names ].sort(),
        location: entry.location,
    }))
}
