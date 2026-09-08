import type { CliEnvironment } from './types'
import type { GenerationDiagnostic } from '@/types'

import { parseArguments } from './arguments'
import { checkDeclarations } from '@/check'
import { generateDeclarations } from '@/generate'
import { listProjects } from '@/projects'
import { loadConfig } from './config'

const formatDiagnostic = (diagnostic: GenerationDiagnostic): string => [
    diagnostic.severity.toUpperCase(),
    diagnostic.projectId === undefined
        ? `schema:${diagnostic.schemaId}`
        : `${diagnostic.projectId}/${diagnostic.targetId}`,
    diagnostic.sourceId,
    diagnostic.location ? `${diagnostic.location.line}:${diagnostic.location.column}` : undefined,
    diagnostic.code,
    diagnostic.message,
].filter(value => value !== undefined).join(' ')

const hasErrors = (
    diagnostics: ReadonlyArray<GenerationDiagnostic>
): boolean => diagnostics.some(diagnostic => diagnostic.severity === 'error')

export const runCli = async (
    arguments_: ReadonlyArray<string>,
    environment: CliEnvironment
): Promise<number> => {
    try {
        const options = await parseArguments(arguments_)
        if ('help' in options) {
            environment.stdout(options.help)
            return 0
        }

        const config = await loadConfig(environment.cwd, options.configFile)

        if (options.command === 'list') {
            const projects = listProjects(config)
            if (projects.length) environment.stdout(`${projects.join('\n')}\n`)

            return 0
        }

        if (options.command === 'generate') {
            const result = await generateDeclarations(config, { force: options.force })
            if (result.diagnostics.length) {
                environment.stderr(`${result.diagnostics.map(formatDiagnostic).join('\n')}\n`)
            }
            if (hasErrors(result.diagnostics)) return 1

            for (const warning of result.warnings ?? []) {
                environment.stderr(`WARNING ${warning.code} ${warning.root}: Output area contains undeclared files; preserved:\n${warning.files.join('\n')}\n`)
            }

            environment.stdout(`Generated ${result.outputs.length} declaration files.\n`)
            return 0
        }

        const result = await checkDeclarations(config)
        if (result.diagnostics.length) {
            environment.stderr(`${result.diagnostics.map(formatDiagnostic).join('\n')}\n`)
        }
        if (result.differences.length) {
            environment.stderr(`${result.differences
                .map(difference => `${difference.kind.toUpperCase()} ${difference.file}`)
                .join('\n')}\n`)
        }
        if (hasErrors(result.diagnostics) || result.differences.length) return 1

        environment.stdout('Declarations are up to date.\n')
        return 0
    } catch (error) {
        const message = String(error).replace(/^(?:Error|YError): /, '')
        environment.stderr(`Error: ${message}\n`)
        return 1
    }
}
