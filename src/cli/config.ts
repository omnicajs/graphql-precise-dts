import type { Config } from '@/config/types'

import { validateConfig } from '@/config/validate'
import { createJiti } from 'jiti'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const defaultConfigFiles = [
    'graphql-dts.config.ts',
    'graphql-dts.config.mts',
    'graphql-dts.config.js',
    'graphql-dts.config.mjs',
]

const resolveConfigFile = (cwd: string, requestedFile?: string): string => {
    if (requestedFile) {
        const file = resolve(cwd, requestedFile)
        if (!existsSync(file)) throw new Error(`Configuration file was not found: ${file}`)

        return file
    }

    const file = defaultConfigFiles
        .map(candidate => resolve(cwd, candidate))
        .find(existsSync)
    if (!file) throw new Error(`Configuration file was not found in: ${cwd}`)

    return file
}

export const loadConfig = async (
    cwd: string,
    requestedFile?: string
): Promise<Config> => {
    const file = resolveConfigFile(cwd, requestedFile)
    const jiti = createJiti(resolve(cwd, '__graphql_precise_dts_cli__.js'), { fsCache: false })
    const config = await jiti.import<unknown>(file, { default: true })
    validateConfig(config)

    return config
}
