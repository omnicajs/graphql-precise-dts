import type { DocumentModelBundle } from './plan/document-model-bundles'
import type { ModelContext } from './models/types'
import type { PluginConfig } from './config'
import type { RenderableOperationModel } from './plan/renderable/types'
import type {
    PluginFunction,
    Types,
} from '@graphql-codegen/plugin-helpers'

import { buildModelRegistry } from './models/registry-builder'
import { dirname } from 'path'
import { emitMissingFragmentDefinitionWarnings } from './lib/documents'
import { emitRepeatedSelectionWarnings } from './lib/repeated-selection-warnings'
import { emitSkippedDocumentWarnings } from './lib/document-errors'
import { findFragmentDefinitions } from './lib/documents'
import { join } from 'path'
import { makeDocumentLocationMap } from './lib/documents'
import { makeDocumentModelBundles } from './plan/document-model-bundles'
import { makeDocumentModelImportMap } from './plan/document-model-imports'
import { makeGenerationDirectivePolicies } from './directives/structural-policies'
import { makeModuleSpecifier } from './path'
import { makeStructuralDirectivePolicies } from './directives/structural-policies'
import { mkdirSync } from 'fs'
import { renderDeclarations } from './render/declarations'
import { renderSchemaDeclaration } from './render/schema'
import { guardNamedOperations } from './lib/document-errors'
import { writeFileSync } from 'fs'

const GENERATED_SCHEMA_FILE_NAME = 'schema'
const EXACT_TYPE_DECLARATION = 'type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }\n'

const haveVariables = (operations: RenderableOperationModel[]): boolean => operations.some(op => op.variables.length > 0)

const getExactType = (operations: RenderableOperationModel[]): string[] => haveVariables(operations) ? [ EXACT_TYPE_DECLARATION ] : []

const makePrepend = (bundles: DocumentModelBundle[]): string[] => [
    ...getExactType(bundles.flatMap(({ models }) => [ ...models.operations.values() ])),
]

export const plugin: PluginFunction<PluginConfig, Types.ComplexPluginOutput> = (
    schema,
    documents,
    config,
    info
) => {
    if (!info?.outputFile) throw new Error('Output file is missing')

    emitSkippedDocumentWarnings(documents)
    guardNamedOperations(documents)

    const schemaOutputFile = join(dirname(info.outputFile), `${GENERATED_SCHEMA_FILE_NAME}.d.ts`)
    const schemaModulePath = `./${GENERATED_SCHEMA_FILE_NAME}`
    const documentModuleSpecifier = (location: string | undefined) => makeModuleSpecifier(
        config.prefix ?? '*/',
        location,
        config.relativeToCwd ?? false,
        config.scope
    )

    const importMap = makeDocumentModelImportMap(schema, documents, schemaModulePath, documentModuleSpecifier)

    const fragmentDefinitions = findFragmentDefinitions(documents)
    const directivePolicies = config.directivePolicies ?? {}

    emitRepeatedSelectionWarnings(documents)
    emitMissingFragmentDefinitionWarnings(documents, fragmentDefinitions)

    const context = {
        schema,
        fragmentDefinitions: fragmentDefinitions instanceof Map
            ? fragmentDefinitions
            : findFragmentDefinitions(fragmentDefinitions),
        documentLocations: makeDocumentLocationMap(documents),
        structuralDirectivePolicies: makeStructuralDirectivePolicies(directivePolicies),
    } satisfies ModelContext

    const registry = buildModelRegistry(
        {
            fragments: [ ...importMap.fragments.keys() ],
            enums: [ ...importMap.enums.keys() ],
        },
        context,
        config.scalars ?? {}
    )

    mkdirSync(dirname(schemaOutputFile), { recursive: true })
    writeFileSync(schemaOutputFile, renderSchemaDeclaration(registry.schema))

    const documentBundles = makeDocumentModelBundles(
        documents,
        registry.documents.fragments,
        context,
        importMap,
        config.scalars ?? {},
        makeGenerationDirectivePolicies(directivePolicies)
    )

    return {
        prepend: makePrepend(documentBundles),
        content: renderDeclarations(
            documentBundles,
            documentModuleSpecifier
        ),
    }
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
