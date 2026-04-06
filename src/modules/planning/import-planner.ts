import type {
    DeclarationDefinitions,
    DefinitionNodeModel,
    FieldValueModel,
} from '../../types/models'
import type { FragmentDefinitionNode } from 'graphql'
import type { FragmentModel } from '../../types/models'
import type {
    GraphQLInputType,
    GraphQLOutputType,
} from 'graphql'
import type { InputValueModel } from '../../types/models'
import type { PluginConfig } from '../../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { TypeInfo } from 'graphql'

import {
    getNamedType,
    isEnumType,
    visit,
    visitWithTypeInfo,
} from 'graphql'

import {
    DefinitionNodeKind,
    FieldValueKind,
    FragmentRootKind,
} from '../../enums/model-kinds'

export type ImportBlocks = {
    fragments: Map<string, string>,
    enums: Map<string, string>,
}

type ImportBlockCollector = {
    blocks: ImportBlocks
    addEnum(typeNode: GraphQLInputType | GraphQLOutputType): void
    addFragment(name: string, location?: string): void
}

type DeclarationImportCollector = {
    imports: Map<string, string>
    importMap: ImportBlocks
}

const createImportBlockCollector = (
    schemaModulePath: string,
    moduleLocation: (location?: string) => string
): ImportBlockCollector => {
    const blocks: ImportBlocks = {
        fragments: new Map<string, string>(),
        enums: new Map<string, string>(),
    }

    return {
        blocks,
        addEnum(typeNode) {
            const namedType = getNamedType(typeNode)
            if (isEnumType(namedType) && !blocks.enums.has(namedType.name)) {
                blocks.enums.set(namedType.name, schemaModulePath)
            }
        },
        addFragment(name, location) {
            if (!blocks.fragments.has(name)) {
                blocks.fragments.set(name, moduleLocation(location))
            }
        },
    }
}

const createImportBlockVisitor = (
    typeInfo: TypeInfo,
    collector: ImportBlockCollector,
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

export const makeImportBlocks = (
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    schemaModulePath: string,
    moduleLocation: (location: string | undefined) => string
): ImportBlocks => {
    const collector = createImportBlockCollector(schemaModulePath, moduleLocation)

    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const typeInfo = new TypeInfo(schema)
        visit(
            documentFile.document,
            visitWithTypeInfo(
                typeInfo,
                createImportBlockVisitor(typeInfo, collector, documentFile.location)
            )
        )
    })

    return collector.blocks
}

const visitDefinitionNodes = (
    collector: DeclarationImportCollector,
    definitions: DefinitionNodeModel[] = []
) => definitions.forEach(definition => visitDefinitionNode(collector, definition))

const visitFieldValueImports = (
    collector: DeclarationImportCollector,
    value: FieldValueModel
) => {
    switch (value.kind) {
        case FieldValueKind.ENUM: {
            const importPath = collector.importMap.enums.get(value.name)
            if (importPath && !collector.imports.has(value.name)) {
                collector.imports.set(value.name, importPath)
            }
            return
        }
        case FieldValueKind.OBJECT:
            visitDefinitionNodes(collector, value.fields)
            return
        case FieldValueKind.UNION:
            value.variants.forEach(({ fields }) => visitDefinitionNodes(collector, fields))
    }
}

const visitDefinitionNode = (
    collector: DeclarationImportCollector,
    definition: DefinitionNodeModel
) => {
    switch (definition.kind) {
        case DefinitionNodeKind.FRAGMENT_SPREAD: {
            const importPath = collector.importMap.fragments.get(definition.name)
            if (importPath && !collector.imports.has(definition.name)) {
                collector.imports.set(definition.name, importPath)
            }
            return
        }
        case DefinitionNodeKind.INLINE_FRAGMENT:
            visitDefinitionNodes(collector, definition.selections)
            return
        case DefinitionNodeKind.FIELD:
            visitFieldValueImports(collector, definition.value)
    }
}

const visitInputValueImports = (
    collector: DeclarationImportCollector,
    value: InputValueModel
) => {
    switch (value.kind) {
        case FieldValueKind.ENUM: {
            const importPath = collector.importMap.enums.get(value.name)
            if (importPath && !collector.imports.has(value.name)) {
                collector.imports.set(value.name, importPath)
            }
            return
        }
        case FieldValueKind.OBJECT:
            value.fields.forEach(field => visitInputValueImports(collector, field.value))
            return
    }
}

const visitFragmentImports = (
    collector: DeclarationImportCollector,
    fragment: FragmentModel
) => {
    if (fragment.root.kind === FragmentRootKind.UNION) {
        fragment.root.variants.forEach(({ fields }) => visitDefinitionNodes(collector, fields))
        return
    }

    visitDefinitionNodes(collector, fragment.root.fields)
}

export const getImportsBlocksForDeclaration = (
    { fragments, operations }: DeclarationDefinitions,
    importMap: ImportBlocks
): Map<string, string> => {
    const collector: DeclarationImportCollector = {
        imports: new Map<string, string>(),
        importMap,
    }

    fragments.forEach(fragment => visitFragmentImports(collector, fragment))

    operations.forEach(({ variables, result }) => {
        variables.forEach(variable => visitInputValueImports(collector, variable.value))
        visitDefinitionNodes(collector, result)
    })

    return collector.imports
}
