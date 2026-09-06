import type {
    Config,
} from '@/config/types'
import type {
    DeclarationFile,
    DeclarationTree,
} from '@/filesystem/types'
import type {
    GenerationOutput,
    GenerateDeclarationsResult,
} from '@/types'

import { validateConfig } from '@/config/validate'
import { resolveCachedSchema } from '@/filesystem/cache'
import { loadDocuments } from '@/filesystem/documents'
import { resolveModuleId } from '@/filesystem/modules'
import {
    makeNestedOutputFile,
    makeOutputFile,
    makeOutputRoot,
} from '@/filesystem/outputs'
import { generateDeclarations as generateTargetDeclarations } from '@/generation/generate'
import { renderAggregate } from '@/generation/render/aggregate'
import { createNamingConvention } from '@/generation/naming'
import { collectScalarNameDiagnostics } from '@/generation/diagnostics/scalars'
import { renderSchemaDeclarations } from '@/schema/render/declarations'
import { renderEnums } from '@/schema/render/enums'

export const createDeclarationPlan = async (
    config: Config,
    { writeCache }: { writeCache: boolean }
) => {
    validateConfig(config)

    const outputs: GenerateDeclarationsResult['outputs'][number][] = []
    const diagnostics: GenerateDeclarationsResult['diagnostics'][number][] = []
    const outputOwners = new Map<string, string>()
    const documentOwners = new Map<string, string>()
    const declarationTrees: DeclarationTree[] = []

    const addOutput = (output: GenerationOutput, owner: string): void => {
        const existingOwner = outputOwners.get(output.file)
        if (existingOwner) {
            throw new Error(`Output file "${output.file}" is produced by both "${existingOwner}" and "${owner}"`)
        }

        outputOwners.set(output.file, owner)
        outputs.push(output)
    }

    for (const schemaId of Object.keys(config.schemas).sort()) {
        const schema = config.schemas[schemaId]!
        const hasTargets = Object.values(config.projects).some(project => (
            Object.values(project.targets).some(target => target.schema === schemaId)
        ))
        if (!schema.outputs && !hasTargets) continue

        const resolvedSchema = resolveCachedSchema({
            root: config.root,
            schemaId,
            schema,
            cache: config.cache,
            writeCache,
        })

        diagnostics.push(...collectScalarNameDiagnostics({
            snapshot: resolvedSchema.snapshot,
            naming: createNamingConvention(schema.naming),
            scalars: schema.scalars ?? {},
            sourceId: schema.file,
        }).map(diagnostic => ({
            ...diagnostic,
            schemaId,
        })))

        if (schema.outputs) {
            const outputRoot = makeOutputRoot(config.root, schema.outputs.root)
            const declarationFiles: DeclarationFile[] = []
            const typesFile = makeNestedOutputFile(config.root, outputRoot, schema.outputs.types)
            const typesContent = renderSchemaDeclarations(resolvedSchema.snapshot, schema)
            addOutput({
                kind: 'schema-types',
                schemaId,
                file: typesFile,
                content: typesContent,
            }, `schema ${schemaId}`)
            declarationFiles.push({ kind: 'schema-types', file: typesFile, content: typesContent })

            if (schema.outputs.enums) {
                const enumsFile = makeNestedOutputFile(
                    config.root,
                    outputRoot,
                    schema.outputs.enums
                )
                const enumsContent = `${renderEnums(
                    resolvedSchema.snapshot,
                    createNamingConvention(schema.naming)
                )}\n`
                addOutput({
                    kind: 'schema-enums',
                    schemaId,
                    file: enumsFile,
                    content: enumsContent,
                }, `schema ${schemaId}`)
                declarationFiles.push({
                    kind: 'schema-enums',
                    file: enumsFile,
                    content: enumsContent,
                })
            }

            declarationTrees.push({ root: outputRoot, files: declarationFiles })
        }

        for (const projectId of Object.keys(config.projects).sort()) {
            const project = config.projects[projectId]!

            for (const targetId of Object.keys(project.targets).sort()) {
                const target = project.targets[targetId]!
                if (target.schema !== schemaId) continue

                const outputRoot = makeOutputRoot(config.root, target.outputs.tree.root)

                const sourceIds = new Map<string, string>()
                const targetOwner = `${projectId}/${targetId}`
                const loadedDocuments = loadDocuments(config.root, project.root, target.documents)
                const documents = loadedDocuments.map(document => {
                    const existingDocumentOwner = documentOwners.get(document.file)
                    if (existingDocumentOwner && existingDocumentOwner !== targetOwner) {
                        throw new Error(
                            `Document file "${document.file}" is selected by both `
                                + `"${existingDocumentOwner}" and "${targetOwner}"`
                        )
                    }
                    documentOwners.set(document.file, targetOwner)
                    const moduleId = resolveModuleId(
                        config.root,
                        document.file,
                        document.id,
                        config.resolve
                    )
                    const existingSourceId = sourceIds.get(moduleId)
                    if (existingSourceId && existingSourceId !== document.id) {
                        throw new Error(
                            `Module ID "${moduleId}" is resolved from both `
                                + `"${existingSourceId}" and "${document.id}" in target `
                                + `"${projectId}/${targetId}"`
                        )
                    }
                    sourceIds.set(moduleId, document.id)
                    const imports = document.imports.map(imported => ({
                        sourceId: resolveModuleId(
                            config.root,
                            imported.file,
                            imported.id,
                            config.resolve
                        ),
                        sourcePath: imported.id,
                        specifier: imported.specifier,
                        external: imported.external,
                        location: imported.location,
                    }))

                    if (!document.document) {
                        diagnostics.push({
                            severity: 'warning',
                            code: 'skipped-document',
                            projectId,
                            targetId,
                            schemaId,
                            sourceId: document.id,
                            location: document.error.location,
                            message: `Document was skipped because it could not be parsed: ${document.error.message}`,
                        })

                        return {
                            id: moduleId,
                            path: document.id,
                            imports,
                        }
                    }

                    return {
                        id: moduleId,
                        path: document.id,
                        imports,
                        document: document.document,
                    }
                })

                const result = await generateTargetDeclarations({
                    projectId,
                    schema: resolvedSchema.input,
                    documents,
                    execution: config.execution,
                    rendering: {
                        paths: Object.fromEntries(documents.map(document => [ document.id, document.path ])),
                        aggregate: !!target.outputs.aggregate,
                    },
                })
                const declarationFiles: DeclarationFile[] = []

                for (const output of result.outputs) {
                    const sourceId = sourceIds.get(output.sourceId)!
                    const file = makeOutputFile(config.root, outputRoot, sourceId)
                    addOutput({
                        kind: 'document-declaration',
                        projectId,
                        targetId,
                        schemaId,
                        sourceId,
                        file,
                        content: output.content,
                    }, `${projectId}/${targetId}`)
                    declarationFiles.push({
                        kind: 'document-declaration',
                        file,
                        content: output.content,
                    })
                }
                if (target.outputs.aggregate && !result.diagnostics.some(
                    diagnostic => diagnostic.severity === 'error'
                )) {
                    const file = makeNestedOutputFile(
                        config.root,
                        outputRoot,
                        target.outputs.aggregate.file
                    )
                    const content = renderAggregate(result.outputs)
                    addOutput({
                        kind: 'aggregate-declaration',
                        projectId,
                        targetId,
                        schemaId,
                        file,
                        content,
                    }, `${projectId}/${targetId}`)
                    declarationFiles.push({ kind: 'aggregate-declaration', file, content })
                }
                declarationTrees.push({ root: outputRoot, files: declarationFiles })
                diagnostics.push(...result.diagnostics.map(diagnostic => ({
                    ...diagnostic,
                    sourceId: sourceIds.get(diagnostic.sourceId)!,
                    projectId,
                    targetId,
                    schemaId,
                })))
            }
        }
    }

    return {
        result: { outputs, diagnostics },
        trees: declarationTrees,
    }
}
