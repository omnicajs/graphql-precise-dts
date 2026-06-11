import type { ModelContext } from './models/types'
import type { PluginConfig } from './config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'

import { assertUniqueDocumentModuleSpecifiers } from './diagnostics/declaration-errors'
import { buildGenerationModels } from './models/generation-builder'
import { dirname } from 'path'
import { emitCustomScalarNamedTypeWarnings } from './diagnostics/scalar-name-warnings'
import {
    emitDuplicateFragmentDefinitionWarnings,
    emitMissingFragmentDefinitionWarnings,
} from './diagnostics/document-warnings'
import { emitRepeatedSelectionWarnings } from './diagnostics/repeated-selection-warnings'
import { emitSkippedDocumentWarnings } from './diagnostics/document-errors'
import { findFragmentDefinitions } from './lib/documents'
import { guardNamedOperations } from './diagnostics/document-errors'
import { makeDeclarationModuleSpecifier } from './path'
import { makeDocumentLocationMap } from './lib/documents'
import { makeDocumentModelBundles } from './plan/document-model-bundles'
import { makeDocumentModelImportMap } from './plan/document-model-imports'
import { makeEnumsOutputFile } from './path'
import { makeGenerationDirectivePolicies } from './directives/structural-policies'
import {
    makeModuleSpecifier,
    makeSchemaDeclarationOutputFile,
    makeSchemaOutputDirectory,
} from './path'
import { makeStructuralDirectivePolicies } from './directives/structural-policies'
import { mkdirSync } from 'fs'
import { renderDeclarations } from './render/declarations'
import { renderEnumsDeclaration } from './render/enum'
import { renderSchemaDeclaration } from './render/schema'
import { writeFileSync } from 'fs'

export const plugin: PluginFunction<PluginConfig, string> = (
    schema,
    documents,
    config,
    info
) => {
    if (!info?.outputFile) throw new Error('Output file is missing')

    emitSkippedDocumentWarnings(documents)
    guardNamedOperations(documents, schema)

    const schemaOutputDirectory = makeSchemaOutputDirectory(info.outputFile, config.schemaOutputDirectory)
    const schemaOutputFile = makeSchemaDeclarationOutputFile(schemaOutputDirectory)

    const enumsOutputFile = makeEnumsOutputFile(schemaOutputDirectory)
    const enumsModulePath = makeDeclarationModuleSpecifier(info.outputFile, enumsOutputFile)

    const documentModuleSpecifier = (location: string | undefined) => makeModuleSpecifier(
        config.prefix ?? '*/',
        location,
        config.relativeToCwd ?? false,
        config.scope
    )

    const importMap = makeDocumentModelImportMap(schema, documents, enumsModulePath, documentModuleSpecifier)

    const fragmentDefinitions = findFragmentDefinitions(documents)
    const directivePolicies = config.directivePolicies ?? {}

    emitRepeatedSelectionWarnings(documents)
    emitDuplicateFragmentDefinitionWarnings(documents)
    emitMissingFragmentDefinitionWarnings(documents, fragmentDefinitions)

    const context = {
        schema,
        fragmentDefinitions: fragmentDefinitions instanceof Map
            ? fragmentDefinitions
            : findFragmentDefinitions(fragmentDefinitions),
        documentLocations: makeDocumentLocationMap(documents),
        structuralDirectivePolicies: makeStructuralDirectivePolicies(directivePolicies),
    } satisfies ModelContext

    const { schema: schemaOutput, registry } = buildGenerationModels(
        {
            fragments: [ ...importMap.fragments.keys() ],
            enums: [ ...importMap.enums.keys() ],
        },
        context,
        config.scalars ?? {}
    )

    emitCustomScalarNamedTypeWarnings({ schema: schemaOutput, registry }, config.scalars ?? {})

    const schemaDeclaration = renderSchemaDeclaration(schemaOutput)
    const enumsDeclaration = registry.enums.size
        ? renderEnumsDeclaration(registry.enums)
        : ''

    mkdirSync(dirname(schemaOutputFile), { recursive: true })
    writeFileSync(schemaOutputFile, schemaDeclaration)

    if (enumsDeclaration) writeFileSync(enumsOutputFile, enumsDeclaration)

    const documentBundles = makeDocumentModelBundles(
        documents,
        context,
        importMap,
        config.scalars ?? {},
        makeGenerationDirectivePolicies(directivePolicies)
    )

    assertUniqueDocumentModuleSpecifiers(documentBundles, documentModuleSpecifier)

    return renderDeclarations(
        documentBundles,
        documentModuleSpecifier,
        makeDeclarationModuleSpecifier(info.outputFile, schemaOutputFile)
    )
}

export type { DirectivePolicy } from './directives/types'
export type {
    NamedObjectField,
    ObjectFieldConfig,
} from './ts-type'
export type { PluginConfig } from './config'
export type { TsType } from './ts-type'

export {
    arrayOf,
    defineBoolean,
    defineGeneric,
    defineLiteral,
    defineNamed,
    defineNull,
    defineNumber,
    defineObject,
    defineObjectField,
    defineString,
    defineTuple,
    defineUnknown,
    intersectionOf,
    unionOf,
    makeNullable,
    renderType,
} from './ts-type'

export { TS_TYPE_KIND } from './ts-type'
