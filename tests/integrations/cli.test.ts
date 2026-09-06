import {
    afterAll,
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest'

import type { CliEnvironment } from '@/cli/types'

import { runCli } from '@/cli/run'
import { createFixtureWorkspace } from '../fixtures/workspace'
import {
    existsSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

const fixtureWorkspace = createFixtureWorkspace()
const root = resolve(fixtureWorkspace.root, 'cli')
const configFile = resolve(root, 'graphql-precise-dts.config.ts')
let stdout = ''
let stderr = ''
const environment: CliEnvironment = {
    cwd: root,
    stdout: message => {
        stdout += message
    },
    stderr: message => {
        stderr += message
    },
}

beforeEach(() => {
    stdout = ''
    stderr = ''
    rmSync(resolve(root, 'generated'), { force: true, recursive: true })
    writeFileSync(resolve(root, 'documents/viewer.graphql'), 'query Viewer { viewer }\n')
})

afterAll(fixtureWorkspace.dispose)

describe('CLI application integration', () => {
    test('shows help when no command is provided', async () => {
        expect(await runCli([], environment)).toBe(0)
        expect(stdout).toContain('graphql-precise-dts <command> [options]')
        expect(stdout).toContain('generate')
        expect(stdout).toContain('check')
        expect(stdout).toContain('graphql-precise-dts list')
        expect(stderr).toBe('')
    })

    test('shows help when explicitly requested', async () => {
        expect(await runCli(['generate', '--help'], environment)).toBe(0)
        expect(stdout).toContain('graphql-precise-dts generate')
        expect(stdout).toContain('Generate and publish declaration files')
        expect(stdout).toContain('--config')
        expect(stderr).toBe('')
    })

    test('rejects the previous list-projects command', async () => {
        expect(await runCli(['list-projects'], environment)).toBe(1)
        expect(stderr).toBe('Error: Unknown command: list-projects\n')
    })

    test('rejects an unknown option', async () => {
        expect(await runCli(['generate', '--project', 'app'], environment)).toBe(1)
        expect(stderr).toBe('Error: Unknown argument: project\n')
    })

    test('requires a config option value', async () => {
        expect(await runCli(['generate', '--config'], environment)).toBe(1)
        expect(stderr).toBe('Error: Not enough arguments following: config\n')

        stderr = ''
        expect(await runCli(['generate', '--config', '--help-disabled'], environment)).toBe(1)
        expect(stderr).toBe('Error: Not enough arguments following: config\n')
    })

    test('rejects a repeated config option', async () => {
        expect(await runCli([
            'generate',
            '--config',
            configFile,
            '--config',
            configFile,
        ], environment)).toBe(1)
        expect(stderr).toBe('Error: Option --config may only be used once\n')
    })

    test('reports a missing explicit config', async () => {
        expect(await runCli(['generate', '--config', 'missing.ts'], environment)).toBe(1)
        expect(stderr).toBe(`Error: Configuration file was not found: ${resolve(root, 'missing.ts')}\n`)
    })

    test('reports a missing default config', async () => {
        const missingEnvironment = { ...environment, cwd: resolve(root, 'documents') }

        expect(await runCli(['generate'], missingEnvironment)).toBe(1)
        expect(stderr).toBe(`Error: Configuration file was not found in: ${resolve(root, 'documents')}\n`)
    })

    test('lists projects from an explicit TypeScript config', async () => {
        expect(await runCli(['list', '--config', configFile], environment)).toBe(0)
        expect(stdout).toBe('app\n')
        expect(stderr).toBe('')
    })

    test('keeps an empty project list silent', async () => {
        expect(await runCli([
            'list',
            '--config',
            resolve(root, 'empty.config.ts'),
        ], environment)).toBe(0)
        expect(stdout).toBe('')
        expect(stderr).toBe('')
    })

    test('checks through the default config without writing outputs', async () => {
        expect(await runCli(['check'], environment)).toBe(1)
        expect(stderr).toBe([
            'MISSING generated/.graphql-precise-dts-manifest.json',
            'MISSING generated/viewer.graphql.d.ts',
            '',
        ].join('\n'))
        expect(existsSync(resolve(root, 'generated'))).toBe(false)
    })

    test('generates and then checks an up-to-date project', async () => {
        expect(await runCli(['generate', '--config', configFile], environment)).toBe(0)
        expect(stdout).toBe('Generated 1 declaration files.\n')
        expect(existsSync(resolve(root, 'generated/viewer.graphql.d.ts'))).toBe(true)

        stdout = ''
        expect(await runCli(['check', '--config', configFile], environment)).toBe(0)
        expect(stdout).toBe('Declarations are up to date.\n')
        expect(stderr).toBe('')
    })

    test('prints generation diagnostics and does not publish invalid documents', async () => {
        writeFileSync(resolve(root, 'documents/viewer.graphql'), 'query Viewer { missing }\n')

        expect(await runCli(['generate', '--config', configFile], environment)).toBe(1)
        expect(stderr).toContain(
            'ERROR app/core viewer.graphql 1:16 invalid-document '
            + 'Type "Query" does not define field "missing"'
        )
        expect(existsSync(resolve(root, 'generated'))).toBe(false)
    })

    test('prints warnings while publishing declarations with a successful exit code', async () => {
        const warningConfig = resolve(root, 'warning.config.ts')

        expect(await runCli(['generate', '--config', warningConfig], environment)).toBe(0)
        expect(stdout).toBe('Generated 1 declaration files.\n')
        expect(stderr).toContain(
            'WARNING schema:core schema.graphql scalar-name-conflict'
        )
        expect(existsSync(resolve(root, 'generated/viewer.graphql.d.ts'))).toBe(true)

        stdout = ''
        stderr = ''
        expect(await runCli(['check', '--config', warningConfig], environment)).toBe(0)
        expect(stdout).toBe('Declarations are up to date.\n')
        expect(stderr).toContain(
            'WARNING schema:core schema.graphql scalar-name-conflict'
        )
    })

    test('prints check diagnostics without reporting incomplete output differences', async () => {
        writeFileSync(resolve(root, 'documents/viewer.graphql'), 'query Viewer { missing }\n')

        expect(await runCli(['check', '--config', configFile], environment)).toBe(1)
        expect(stderr).toContain('ERROR app/core viewer.graphql 1:16 invalid-document')
        expect(stderr).not.toContain('MISSING')
        expect(existsSync(resolve(root, 'generated'))).toBe(false)
    })

    test('reports config execution failures', async () => {
        expect(await runCli([
            'list',
            '--config',
            resolve(root, 'throw.config.js'),
        ], environment)).toBe(1)
        expect(stderr).toBe('Error: config failed\n')
    })
})
