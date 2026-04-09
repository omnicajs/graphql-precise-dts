import type { DocumentModelBundle } from './plan/declarations'
import type { ImportMap } from './plan/imports'
import type { ModelContext } from './models/types'
import type { PluginConfig } from './config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { Types } from '@graphql-codegen/plugin-helpers'

import { FragmentDefinitionNode } from 'graphql/index'

import { buildModelRegistry } from './models/builder'
import { collectImportsForDocumentModels } from './plan/imports'
import { dirname } from 'path'
import { join } from 'path'
import { makeDocumentModelBundles } from './plan/declarations'
import { makeImportMap } from './plan/imports'
import { makeModuleSpecifier } from './path'
import { mkdirSync } from 'fs'
import { renderDeclaration } from './render/declarations'
import { renderSchemaDeclaration } from './render/schema'
import { writeFileSync } from 'fs'

import { Kind } from 'graphql/index'

const GENERATED_SCHEMA_FILE_NAME = 'schema'

const renderDeclarations = (
    documentBundles: DocumentModelBundle[],
    importMap: ImportMap,
    documentModuleSpecifier: (location: string | undefined) => string
): string => documentBundles
    .map(({ location, models }) => renderDeclaration(
        documentModuleSpecifier(location),
        models,
        collectImportsForDocumentModels(models, importMap)
    ))
    .filter(Boolean)
    .join('\n\n')

const findFragmentDefinitions = (
    documents: Parameters<PluginFunction<PluginConfig>>[1]
): Map<string, FragmentDefinitionNode> => {
    const fragments = new Map<string, FragmentDefinitionNode>()

    documents.forEach(({ document }) =>
        document?.definitions.forEach(definition => {
            if (definition.kind === Kind.FRAGMENT_DEFINITION && !fragments.has(definition.name.value)) {
                fragments.set(definition.name.value, definition)
            }
        })
    )

    return fragments
}

const makePrepend = (): string[] => [
    'type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }\n',
]

export const plugin: PluginFunction<PluginConfig, Types.ComplexPluginOutput> = (
    schema,
    documents,
    config,
    info
) => {
    if (!info?.outputFile) throw new Error('Output file is missing')

    const schemaOutputFile = join(dirname(info.outputFile), `${GENERATED_SCHEMA_FILE_NAME}.d.ts`)
    const schemaModulePath = `./${GENERATED_SCHEMA_FILE_NAME}`
    const documentModuleSpecifier = (location: string | undefined) => makeModuleSpecifier(
        config.prefix ?? '*/',
        location,
        config.relativeToCwd ?? false,
        config.scope
    )

    const importMap = makeImportMap(schema, documents, schemaModulePath, documentModuleSpecifier)

    const fragmentDefinitions = findFragmentDefinitions(documents)
    const context = {
        schema,
        fragmentDefinitions: fragmentDefinitions instanceof Map
            ? fragmentDefinitions
            : findFragmentDefinitions(fragmentDefinitions),
        customScalars: config.scalars ?? {},
        directivePolicies: config.directivePolicies ?? {},
    } satisfies ModelContext

    const registry = buildModelRegistry(
        {
            fragments: [ ...importMap.fragments.keys() ],
            enums: [ ...importMap.enums.keys() ],
        },
        context
    )

    mkdirSync(dirname(schemaOutputFile), { recursive: true })
    writeFileSync(schemaOutputFile, renderSchemaDeclaration(registry.schema))

    return {
        prepend: makePrepend(),
        content: renderDeclarations(
            makeDocumentModelBundles(documents, registry.documents.fragments, context),
            importMap,
            documentModuleSpecifier
        ),
    }
}
