import type { PluginFunction, Types } from '@graphql-codegen/plugin-helpers'
import type { CodegenConfig } from './codegen/types'
import type {
    DocumentImport,
    GenerationDiagnostic,
    ParsedDocumentSource,
} from '@/generation/types'

import { collectDocumentImports } from '@/filesystem/imports'
import { createHash } from 'node:crypto'
import { createSchemaSnapshot } from '@/schema/snapshot/create'
import { existsSync, readFileSync } from 'node:fs'
import { generateDeclarations } from '@/generation/generate'
import { GraphQLSchemaView } from '@/schema/graphql'
import {
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path'
import { lexicographicSortSchema, printSchema } from 'graphql'
import { renderAggregate } from '@/generation/render/aggregate'
import { resolveModuleId } from '@/filesystem/modules'
import { validateCodegenConfig } from './codegen/validate'

const normalizePath = (path: string): string => path.split(sep).join('/')

const resolveDocument = (
    source: Types.DocumentFile,
    index: number,
    root: string,
    config: CodegenConfig
): ParsedDocumentSource => {
    if (!source.location) {
        throw new Error(`Codegen document at index ${index} does not have a location`)
    }
    if (!source.document) {
        throw new Error(`Codegen document "${source.location}" does not have a parsed document`)
    }

    const file = resolve(root, source.location)
    const sourcePath = relative(root, file)
    if (sourcePath === '..' || sourcePath.startsWith(`..${sep}`) || isAbsolute(sourcePath)) {
        throw new Error(`Codegen document must be inside root: ${source.location}`)
    }

    const sourceId = normalizePath(sourcePath)
    const contents = existsSync(file)
        ? readFileSync(file, 'utf8')
        : source.document.loc?.source.body ?? source.rawSDL ?? ''
    const imports: DocumentImport[] = collectDocumentImports(root, file, contents).map(
        imported => ({
            sourceId: resolveModuleId(root, imported.file, imported.id, config.resolve),
            sourcePath: imported.id,
            specifier: imported.specifier,
            external: imported.external,
            location: imported.location,
        })
    )

    return {
        id: resolveModuleId(root, file, sourceId, config.resolve),
        path: sourceId,
        imports,
        document: source.document,
    }
}

const formatDiagnostic = (diagnostic: GenerationDiagnostic): string => {
    const location = diagnostic.location!

    return `${diagnostic.sourceId}:${location.line}:${location.column} `
        + `[${diagnostic.code}] ${diagnostic.message}`
}

const validateModuleIds = (sources: ReadonlyArray<ParsedDocumentSource>): void => {
    const sourcePaths = new Map<string, string>()

    for (const source of sources) {
        const existingSourcePath = sourcePaths.get(source.id)
        if (existingSourcePath && existingSourcePath !== source.path) {
            throw new Error(
                `Module ID "${source.id}" is resolved from both `
                + `"${existingSourcePath}" and "${source.path}" in Codegen adapter`
            )
        }
        sourcePaths.set(source.id, source.path)
    }
}

export const plugin: PluginFunction<CodegenConfig, string> = async (
    schema,
    documents,
    config
) => {
    validateCodegenConfig(config)

    const root = resolve(config.root ?? process.cwd())
    const schemaSource = printSchema(lexicographicSortSchema(schema))
    const snapshot = createSchemaSnapshot(
        new GraphQLSchemaView(schema),
        `sha256:${createHash('sha256').update(schemaSource).digest('hex')}`
    )
    const sources = documents
        .map((source, index) => resolveDocument(source, index, root, config))
        .sort((left, right) => left.path.localeCompare(right.path))
    validateModuleIds(sources)
    const result = await generateDeclarations({
        projectId: 'codegen',
        schema: {
            snapshot,
            typesModule: config.typesModule,
            enumsModule: config.enumsModule,
            scalars: config.scalars,
            directives: config.directives,
            naming: config.naming,
            typename: config.typename,
        },
        documents: sources,
    })
    const errors = result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')

    for (const warning of result.diagnostics.filter(
        diagnostic => diagnostic.severity === 'warning'
    )) {
        console.warn(formatDiagnostic(warning))
    }

    if (errors.length) {
        throw new Error([
            'GraphQL declaration generation failed:',
            ...errors.map(formatDiagnostic),
        ].join('\n'))
    }

    return renderAggregate(result.outputs)
}

export type { CodegenConfig } from './codegen/types'
export type { CodegenConfig as PluginConfig } from './codegen/types'
