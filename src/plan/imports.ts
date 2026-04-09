import type {
    DocumentModels,
    FieldValue,
} from '../models/types'
import type { FragmentDefinitionNode } from 'graphql'
import type { FragmentModel } from '../models/types'
import type {
    GraphQLInputType,
    GraphQLOutputType,
} from 'graphql'
import type { InputValue } from '../models/types'
import type { PluginConfig } from '../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { SelectionModel } from '../models/types'

import { TypeInfo } from 'graphql'

import {
    getNamedType,
    isEnumType,
    visit,
    visitWithTypeInfo,
} from 'graphql'

import {
    FragmentRootKind,
    SelectionModelKind,
    ValueModelKind,
} from '../models/kinds'

export type ImportMap = {
    fragments: Map<string, string>,
    enums: Map<string, string>,
}

type ImportMapCollector = {
    imports: ImportMap
    addEnum(typeNode: GraphQLInputType | GraphQLOutputType): void
    addFragment(name: string, location?: string): void
}

type DocumentImportCollector = {
    imports: Map<string, string>
    importMap: ImportMap
}

const createImportMapCollector = (
    schemaModulePath: string,
    moduleLocation: (location?: string) => string
): ImportMapCollector => {
    const imports: ImportMap = {
        fragments: new Map<string, string>(),
        enums: new Map<string, string>(),
    }

    return {
        imports,
        addEnum(typeNode) {
            const namedType = getNamedType(typeNode)
            if (isEnumType(namedType) && !imports.enums.has(namedType.name)) {
                imports.enums.set(namedType.name, schemaModulePath)
            }
        },
        addFragment(name, location) {
            if (!imports.fragments.has(name)) {
                imports.fragments.set(name, moduleLocation(location))
            }
        },
    }
}

const createImportMapVisitor = (
    typeInfo: TypeInfo,
    collector: ImportMapCollector,
    location?: string
) => ({
    EnumValue() {
        const inputType = typeInfo.getInputType()
        if (inputType) collector.addEnum(inputType)
    },
    Field() {
        const fieldDef = typeInfo.getFieldDef()
        if (fieldDef) collector.addEnum(fieldDef.type)
    },
    VariableDefinition() {
        const inputType = typeInfo.getInputType()
        if (inputType) collector.addEnum(inputType)
    },
    FragmentDefinition(node: FragmentDefinitionNode) {
        collector.addFragment(node.name.value, location)
    },
})

export const makeImportMap = (
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    schemaModulePath: string,
    moduleLocation: (location: string | undefined) => string
): ImportMap => {
    const collector = createImportMapCollector(schemaModulePath, moduleLocation)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const typeInfo = new TypeInfo(schema)
        visit(
            documentFile.document,
            visitWithTypeInfo(
                typeInfo,
                createImportMapVisitor(typeInfo, collector, documentFile.location)
            )
        )
    })

    return collector.imports
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
        case ValueModelKind.ENUM: {
            const importPath = collector.importMap.enums.get(value.name)
            if (importPath && !collector.imports.has(value.name)) {
                collector.imports.set(value.name, importPath)
            }
            return
        }
        case ValueModelKind.OBJECT:
            visitSelectionModels(collector, value.fields)
            return
        case ValueModelKind.UNION:
            value.variants.forEach(({ fields }) => visitSelectionModels(collector, fields))
    }
}

const visitSelectionModel = (
    collector: DocumentImportCollector,
    selection: SelectionModel
) => {
    switch (selection.kind) {
        case SelectionModelKind.FRAGMENT_SPREAD: {
            const importPath = collector.importMap.fragments.get(selection.name)
            if (importPath && !collector.imports.has(selection.name)) {
                collector.imports.set(selection.name, importPath)
            }
            return
        }
        case SelectionModelKind.INLINE_FRAGMENT:
            visitSelectionModels(collector, selection.selections)
            return
        case SelectionModelKind.FIELD:
            visitFieldValueImports(collector, selection.value)
    }
}

const visitInputValueImports = (
    collector: DocumentImportCollector,
    value: InputValue
) => {
    switch (value.kind) {
        case ValueModelKind.ENUM: {
            const importPath = collector.importMap.enums.get(value.name)
            if (importPath && !collector.imports.has(value.name)) {
                collector.imports.set(value.name, importPath)
            }
            return
        }
        case ValueModelKind.OBJECT:
            value.fields.forEach(field => visitInputValueImports(collector, field.value))
            return
    }
}

const visitFragmentImports = (
    collector: DocumentImportCollector,
    fragment: FragmentModel
) => {
    if (fragment.root.kind === FragmentRootKind.UNION) {
        fragment.root.variants.forEach(({ fields }) => visitSelectionModels(collector, fields))
        return
    }

    visitSelectionModels(collector, fragment.root.fields)
}

export const collectImportsForDocumentModels = (
    { fragments, operations }: DocumentModels,
    importMap: ImportMap
): Map<string, string> => {
    const collector: DocumentImportCollector = {
        imports: new Map<string, string>(),
        importMap,
    }

    fragments.forEach(fragment => visitFragmentImports(collector, fragment))

    operations.forEach(({ variables, result }) => {
        variables.forEach(variable => visitInputValueImports(collector, variable.value))
        visitSelectionModels(collector, result)
    })

    return collector.imports
}
