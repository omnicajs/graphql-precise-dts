import type { CollectedDocumentModels } from '../models/types'
import type { DocumentFile } from '../config'
import type { FieldValue } from '../models/types'
import type { FragmentDefinitionNode } from 'graphql'
import type { FragmentModel } from '../models/types'
import type {
    GraphQLInputType,
    GraphQLOutputType,
} from 'graphql'
import type { Schema } from '../config'
import type {
    SelectionModel,
    VariableValue,
} from '../models/types'

import { TypeInfo } from 'graphql'

import {
    getNamedType,
    isEnumType,
    visit,
    visitWithTypeInfo,
} from 'graphql'

import {
    FRAGMENT_ROOT_KIND,
    SELECTION_MODEL_KIND,
    VALUE_MODEL_KIND,
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
    schema: Schema,
    documents: DocumentFile[],
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
            const importPath = collector.importMap.fragments.get(selection.name)
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

export const collectImportsForDocumentModels = (
    { fragments, operations }: CollectedDocumentModels,
    importMap: ImportMap
): Map<string, string> => {
    const collector: DocumentImportCollector = {
        imports: new Map<string, string>(),
        importMap,
    }

    fragments.forEach(fragment => visitFragmentImports(collector, fragment))

    operations.forEach(({ variables, result }) => {
        variables.forEach(variable => visitVariableValueImports(collector, variable.value))
        visitSelectionModels(collector, result)
    })

    return collector.imports
}
