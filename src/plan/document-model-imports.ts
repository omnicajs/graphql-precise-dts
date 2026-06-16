import type {
    CollectedDocumentModels,
    FieldValue,
    FragmentModel,
    SelectionModel,
    VariableValue,
} from '../models/types'

import type {
    DocumentFile,
    Schema,
} from '../plugin-types'

import type {
    FragmentDefinitionNode,
    GraphQLInputType,
    GraphQLOutputType,
} from 'graphql'

import { posix } from 'path'

import { TypeInfo } from 'graphql'

import { existsSync } from 'fs'
import {
    getNamedType,
    isEnumType,
} from 'graphql'
import { readFileSync } from 'fs'
import {
    visit,
    visitWithTypeInfo,
} from 'graphql'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
} from '../kinds'

export type DocumentModelImportMap = {
    fragments: Map<string, FragmentImportSource[]>,
    enums: Map<string, string>,
    documentImports: Map<string, Set<string>>,
}

export type FragmentImportSource = {
    location: string | undefined;
    moduleSpecifier: string;
    definition?: FragmentDefinitionNode;
}

type ImportMapCollector = {
    imports: DocumentModelImportMap
    addEnum(typeNode: GraphQLInputType | GraphQLOutputType): void
    addFragment(node: FragmentDefinitionNode, location?: string): void
    addDocumentImports(location: string | undefined, imports: string[]): void
}

type DocumentImportCollector = {
    imports: Map<string, string>
    importMap: DocumentModelImportMap
    location: string | undefined
    localFragments: Set<string>
}

const createImportMapCollector = (
    schemaModulePath: string,
    moduleLocation: (location?: string) => string
): ImportMapCollector => {
    const imports: DocumentModelImportMap = {
        fragments: new Map<string, FragmentImportSource[]>(),
        enums: new Map<string, string>(),
        documentImports: new Map<string, Set<string>>(),
    }

    return {
        imports,
        addEnum(typeNode) {
            const namedType = getNamedType(typeNode)
            if (isEnumType(namedType) && !imports.enums.has(namedType.name)) {
                imports.enums.set(namedType.name, schemaModulePath)
            }
        },
        addFragment(node, location) {
            const name = node.name.value
            const normalizedLocation = location ? normalizeDocumentLocation(location) : undefined
            const sources = imports.fragments.get(name) ?? []
            if (sources.some(source => source.location === normalizedLocation)) return

            const source: FragmentImportSource = {
                location: normalizedLocation,
                moduleSpecifier: moduleLocation(location),
            }

            Object.defineProperty(source, 'definition', { value: node })
            sources.push(source)
            imports.fragments.set(name, sources)
        },
        addDocumentImports(location, documentImports) {
            if (!location || !documentImports.length) return

            imports.documentImports.set(normalizeDocumentLocation(location), new Set(documentImports))
        },
    }
}

const normalizeDocumentLocation = (location: string): string => location.split('\\').join('/')

const resolveDocumentImportLocation = (
    documentLocation: string,
    importedLocation: string
): string => {
    const normalizedImport = normalizeDocumentLocation(importedLocation)
    if (normalizedImport.startsWith('/')) return posix.normalize(normalizedImport)

    return posix.normalize(posix.join(
        posix.dirname(normalizeDocumentLocation(documentLocation)),
        normalizedImport
    ))
}

const collectDocumentImportLocations = (
    documentFile: DocumentFile
): string[] => {
    const documentLocation = documentFile.location
    if (!documentLocation) return []

    const sourceBodies = [
        documentFile.rawSDL,
        documentFile.document?.loc?.source.body,
        documentFile.document?.definitions[0]?.loc?.source.body,
        existsSync(documentLocation) ? readFileSync(documentLocation, 'utf8') : undefined,
    ].filter((sourceBody): sourceBody is string => !!sourceBody)

    for (const sourceBody of sourceBodies) {
        const imports = [ ...sourceBody.matchAll(/^\s*#\s*import\s+["']([^"']+)["']/gm) ]
            .map(match => resolveDocumentImportLocation(documentLocation, match[1]))
        if (imports.length) return imports
    }

    return []
}

const assertDocumentImportsExist = (
    documentImports: Map<string, Set<string>>,
    documentLocations: Set<string>
) => {
    documentImports.forEach((imports, location) => {
        imports.forEach(importLocation => {
            if (documentLocations.has(importLocation)) return

            throw new Error(
                `Document "${location}" imports "${importLocation}", but that document was not found among the documents configured for the plugin. `
                + 'Add the imported document to the GraphQL Code Generator documents list or remove the import.'
            )
        })
    })
}

const createImportMapVisitor = (
    typeInfo: TypeInfo,
    collector: ImportMapCollector,
    location?: string
) => ({
    EnumValue() {
        const inputType = typeInfo.getInputType()
        /* v8 ignore next -- @preserve TypeInfo resolves enum literal input types for valid GraphQL documents. */
        if (inputType) collector.addEnum(inputType)
    },
    Field() {
        const fieldDef = typeInfo.getFieldDef()
        /* v8 ignore next -- @preserve TypeInfo resolves field definitions for valid GraphQL field selections. */
        if (fieldDef) collector.addEnum(fieldDef.type)
    },
    VariableDefinition() {
        const inputType = typeInfo.getInputType()
        /* v8 ignore next -- @preserve TypeInfo resolves variable input types for valid GraphQL operation definitions. */
        if (inputType) collector.addEnum(inputType)
    },
    FragmentDefinition(node: FragmentDefinitionNode) {
        collector.addFragment(node, location)
    },
})

export const makeDocumentModelImportMap = (
    schema: Schema,
    documents: DocumentFile[],
    schemaModulePath: string,
    moduleLocation: (location: string | undefined) => string
): DocumentModelImportMap => {
    const collector = createImportMapCollector(schemaModulePath, moduleLocation)
    const documentLocations = new Set(
        documents
            .filter((documentFile): documentFile is DocumentFile & { location: string } =>
                !!documentFile.document && !!documentFile.location)
            .map(documentFile => normalizeDocumentLocation(documentFile.location))
    )

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        collector.addDocumentImports(documentFile.location, collectDocumentImportLocations(documentFile))

        const typeInfo = new TypeInfo(schema)
        visit(
            documentFile.document,
            visitWithTypeInfo(
                typeInfo,
                createImportMapVisitor(typeInfo, collector, documentFile.location)
            )
        )
    })

    assertDocumentImportsExist(collector.imports.documentImports, documentLocations)

    return collector.imports
}

const findFragmentImportPath = (
    collector: DocumentImportCollector,
    name: string
): string | undefined => {
    const externalSources = collector.importMap.fragments
        .get(name)
        ?.filter(source => !source.location || source.location !== collector.location)
        ?? []
    const documentImports = collector.location
        ? collector.importMap.documentImports.get(collector.location)
        : undefined

    if (documentImports?.size) {
        const location = collector.location as string
        const matchingSources = externalSources
            .filter(source => source.location && documentImports.has(source.location))
        if (matchingSources.length === 1) return matchingSources[0]?.moduleSpecifier

        if (matchingSources.length > 1) {
            throw new Error(
                `Fragment definition "${name}" referenced from "${location}" is ambiguous because multiple imported documents define it. `
                + `Matching imports: ${matchingSources.map(source => `"${source.location}"`).join(', ')}.`
            )
        }

        throw new Error(
            `Fragment definition "${name}" referenced from "${location}" was not found in that document's imports. `
            + `Imported documents: ${[ ...documentImports ].map(importLocation => `"${importLocation}"`).join(', ')}.`
        )
    }

    if (externalSources.length) {
        throw new Error(
            `Fragment definition "${name}" referenced from "${collector.location ?? '<unknown document>'}" is external, but the document does not declare any #import for it. `
            + 'Add an explicit #import for the fragment source.'
        )
    }

    throw new Error(
        `Fragment definition "${name}" referenced from "${collector.location ?? '<unknown document>'}" was not found among the documents configured for the plugin.`
    )
}

const visitSelectionModels = (
    collector: DocumentImportCollector,
    selections: SelectionModel[] = []
) => selections.forEach(selection => visitSelectionModel(collector, selection))

const visitFieldValueImports = (
    collector: DocumentImportCollector,
    value: FieldValue
) => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.ENUM: {
            const importPath = collector.importMap.enums.get(value.name)
            if (importPath && !collector.imports.has(value.name)) {
                collector.imports.set(value.name, importPath)
            }
            return
        }
        case VALUE_MODEL_KIND.OBJECT:
            visitSelectionModels(collector, value.fields)
            return
        case VALUE_MODEL_KIND.UNION:
            value.variants.forEach(({ fields }) => visitSelectionModels(collector, fields))
    }
}

const visitSelectionModel = (
    collector: DocumentImportCollector,
    selection: SelectionModel
) => {
    switch (selection.kind) {
        case SELECTION_MODEL_KIND.FRAGMENT_SPREAD: {
            if (collector.localFragments.has(selection.name)) return

            const importPath = findFragmentImportPath(collector, selection.name)
            if (importPath && !collector.imports.has(selection.name)) {
                collector.imports.set(selection.name, importPath)
            }
            return
        }
        case SELECTION_MODEL_KIND.INLINE_FRAGMENT:
            visitSelectionModels(collector, selection.selections)
            return
        case SELECTION_MODEL_KIND.FIELD:
            visitFieldValueImports(collector, selection.value)
    }
}

const visitVariableValueImports = (
    collector: DocumentImportCollector,
    value: VariableValue
) => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.ENUM: {
            const importPath = collector.importMap.enums.get(value.name)
            if (importPath && !collector.imports.has(value.name)) {
                collector.imports.set(value.name, importPath)
            }
            return
        }
        case VALUE_MODEL_KIND.OBJECT:
            value.fields.forEach(field => visitVariableValueImports(collector, field.value))
            return
    }
}

const visitFragmentImports = (
    collector: DocumentImportCollector,
    fragment: FragmentModel
) => {
    if (fragment.root.kind === FRAGMENT_ROOT_KIND.UNION) {
        fragment.root.variants.forEach(({ fields }) => visitSelectionModels(collector, fields))
        return
    }

    visitSelectionModels(collector, fragment.root.fields)
}

export const collectDocumentModelImports = (
    { fragments, operations }: CollectedDocumentModels,
    importMap: DocumentModelImportMap,
    location?: string
): Map<string, string> => {
    const collector: DocumentImportCollector = {
        imports: new Map<string, string>(),
        importMap,
        location: location ? normalizeDocumentLocation(location) : undefined,
        localFragments: new Set(fragments.keys()),
    }

    fragments.forEach(fragment => visitFragmentImports(collector, fragment))

    operations.forEach(({ variables, result }) => {
        variables.forEach(variable => visitVariableValueImports(collector, variable.value))
        visitSelectionModels(collector, result)
    })

    return collector.imports
}
