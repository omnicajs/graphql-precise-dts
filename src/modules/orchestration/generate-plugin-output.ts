import type { DocumentDeclaration } from '../planning/document-declarations'
import type { ImportBlocks } from '../planning/import-planner'
import type { ModelContext } from '../../types/models'
import type { PluginConfig } from '../../config'
import type { PluginFunction } from '@graphql-codegen/plugin-helpers'
import type { Types } from '@graphql-codegen/plugin-helpers'

import { FragmentDefinitionNode } from 'graphql/index'

import { buildDefinitionRegistry } from '../model-builder'
import { dirname } from 'path'
import { getImportsBlocksForDeclaration } from '../planning/import-planner'
import { isAbsolute } from 'path'
import { join } from 'path'
import { makeDocumentDeclarations } from '../planning/document-declarations'
import { makeImportBlocks } from '../planning/import-planner'
import { mkdirSync } from 'fs'
import { relative } from 'path'
import { renderDeclaration } from '../rendering/typed-declaration'
import { renderSchemaDeclaration } from '../rendering/schema-declaration'
import { writeFileSync } from 'fs'

import { Kind } from 'graphql/index'

const DEFAULT_DOCUMENT_NAME = '*.graphql'
const GENERATED_SCHEMA_FILE_NAME = 'schema'

const normalizePath = (value: string): string => value.split('\\').join('/')

const resolveScopeRoot = (scope?: string): string | undefined => {
    if (!scope) return

    const normalizedScope = normalizePath(scope).replace(/\/+$/, '')
    const lastSlashIndex = normalizedScope.lastIndexOf('/')

    if (lastSlashIndex === -1) return normalizedScope

    return normalizedScope.slice(0, lastSlashIndex + 1)
}

const resolveDocumentModulePath = (
    documentLocation: string,
    relativeMode: boolean
): string => {
    if (relativeMode || isAbsolute(documentLocation)) {
        return normalizePath(relative(process.cwd(), documentLocation))
    }

    return normalizePath(documentLocation)
}

const makeRelativeModuleSpecifier = (path: string): string => {
    if (path === DEFAULT_DOCUMENT_NAME) return path
    if (path.startsWith('./') || path.startsWith('../')) return path

    return `./${path}`
}

export const makeModuleLocation = (
    prefix: string,
    documentLocation?: string,
    relativeMode = false,
    scope?: string
): string => {
    if (documentLocation) {
        const normalizedDocumentLocation = normalizePath(documentLocation)
        const scopeRoot = resolveScopeRoot(scope)

        if (scopeRoot) {
            const scopeStartIndex = normalizedDocumentLocation.indexOf(scopeRoot)

            if (scopeStartIndex !== -1) {
                const scopedPath = normalizedDocumentLocation.slice(scopeStartIndex)

                return prefix
                    ? `${prefix}${scopedPath}`
                    : makeRelativeModuleSpecifier(scopedPath)
            }
        }
    }

    const fileName = documentLocation
        ? resolveDocumentModulePath(documentLocation, relativeMode)
        : DEFAULT_DOCUMENT_NAME

    return prefix
        ? `${prefix}${fileName}`
        : makeRelativeModuleSpecifier(fileName)
}

const renderDeclarations = (
    documentDeclarations: DocumentDeclaration[],
    importBlocks: ImportBlocks,
    declarationModuleLocation: (location: string | undefined) => string
): string => documentDeclarations
    .map(({ location, declarations }) => renderDeclaration(
        declarationModuleLocation(location),
        declarations,
        getImportsBlocksForDeclaration(declarations, importBlocks)
    ))
    .filter(Boolean)
    .join('\n\n')

const findFragmentsDefs = (
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

export const generatePluginOutput = (
    schema: Parameters<PluginFunction<PluginConfig>>[0],
    documents: Parameters<PluginFunction<PluginConfig>>[1],
    config: PluginConfig,
    info?: Parameters<PluginFunction<PluginConfig>>[3]
): Types.ComplexPluginOutput => {
    if (!info?.outputFile) throw new Error('Output file is missing')

    const schemaOutputFile = join(dirname(info.outputFile), `${GENERATED_SCHEMA_FILE_NAME}.d.ts`)
    const schemaModulePath = `./${GENERATED_SCHEMA_FILE_NAME}`
    const declarationModuleLocation = (location: string | undefined) => makeModuleLocation(
        config.prefix ?? '*/',
        location,
        config.relativeToCwd ?? false,
        config.scope
    )

    const importBlocks = makeImportBlocks(schema, documents, schemaModulePath, declarationModuleLocation)

    const fragmentDefinitions = findFragmentsDefs(documents)
    const context = {
        schema,
        fragmentsDefs: fragmentDefinitions instanceof Map
            ? fragmentDefinitions
            : findFragmentsDefs(fragmentDefinitions),
        customScalars: config.scalars ?? {},
        directivePolicies: config.directivePolicies ?? {},
    } satisfies ModelContext

    const defRegistry = buildDefinitionRegistry(
        {
            fragment: [ ...importBlocks.fragments.keys() ],
            enums: [ ...importBlocks.enums.keys() ],
        },
        context
    )

    mkdirSync(dirname(schemaOutputFile), { recursive: true })
    writeFileSync(schemaOutputFile, renderSchemaDeclaration(defRegistry))

    return {
        prepend: makePrepend(),
        content: renderDeclarations(
            makeDocumentDeclarations(documents, defRegistry, context),
            importBlocks,
            declarationModuleLocation
        ),
    }
}
