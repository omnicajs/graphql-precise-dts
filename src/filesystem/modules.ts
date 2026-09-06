import type { ResolveConfig } from '@/config/types'

import {
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path'

type AliasMatch = {
    path: string
    module: string
    suffix: string
}

const normalizePath = (path: string): string => path.split(sep).join('/')

export const resolveModuleId = (
    root: string,
    file: string,
    sourceId: string,
    config?: ResolveConfig
): string => {
    const match = Object.entries(config?.alias ?? {})
        .map(([ path, module ]): AliasMatch | undefined => {
            const absolutePath = resolve(root, path)
            const suffix = relative(absolutePath, file)

            if (suffix === '..' || suffix.startsWith(`..${sep}`) || isAbsolute(suffix)) return

            return {
                path: absolutePath,
                module: module.replace(/\/+$/, ''),
                suffix: normalizePath(suffix),
            }
        })
        .filter((candidate): candidate is AliasMatch => candidate !== undefined)
        .sort((left, right) => right.path.length - left.path.length)[0]

    if (!match) return sourceId

    return match.suffix ? `${match.module}/${match.suffix}` : match.module
}
