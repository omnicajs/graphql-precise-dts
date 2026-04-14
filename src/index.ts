import type { DocumentModelBundle } from './plan/declarations'
import type { FragmentDefinitionNode } from 'graphql'
import type {
    ModelContext,
    OperationModel,
} from './models/types'
import type { PluginConfig } from './config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { Types } from '@graphql-codegen/plugin-helpers'

import { buildModelRegistry } from './models/registry-builder'
import { dirname } from 'path'
import { join } from 'path'
import { makeDocumentModelBundles } from './plan/declarations'
import { makeImportMap } from './plan/imports'
import { makeModuleSpecifier } from './path'
import { mkdirSync } from 'fs'
import { renderDeclarations } from './render/declarations'
import { renderSchemaDeclaration } from './render/schema'
import { writeFileSync } from 'fs'

import { Kind } from 'graphql'

const GENERATED_SCHEMA_FILE_NAME = 'schema'
const EXACT_TYPE_DECLARATION = 'type Exact<T extends { [ key: string ]: unknown }> = { [ K in keyof T ]: T[K] }\n'

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

const haveVariables = (operations: OperationModel[]): boolean => operations.some(op => op.variables.length > 0)

const getExactType = (operations: OperationModel[]): string[] => haveVariables(operations) ? [ EXACT_TYPE_DECLARATION ] : []

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

    const documentBundles = makeDocumentModelBundles(documents, registry.documents.fragments, context)

    return {
        prepend: makePrepend(documentBundles),
        content: renderDeclarations(
            documentBundles,
            importMap,
            documentModuleSpecifier
        ),
    }
}
