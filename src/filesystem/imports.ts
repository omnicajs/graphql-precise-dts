import type { LoadedDocumentImport } from './types'

import { getLocation, Source } from 'graphql'
import {
    dirname,
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path'

const importPattern = /^\s*#\s*import\s+["']([^"']+)["']/gm

const normalizePath = (path: string): string => path.split(sep).join('/')

const isOutside = (path: string): boolean => (
    path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
)

export const collectDocumentImports = (
    projectRoot: string,
    documentFile: string,
    contents: string
): ReadonlyArray<LoadedDocumentImport> => {
    const source = new Source(contents)

    return [ ...contents.matchAll(importPattern) ].map(match => {
        const specifier = match[1]!
        const file = resolve(dirname(documentFile), specifier)
        const projectPath = relative(projectRoot, file)
        const hashOffset = match[0].indexOf('#')

        return {
            specifier,
            file,
            id: normalizePath(projectPath),
            external: isOutside(projectPath),
            location: getLocation(source, match.index! + hashOffset),
        }
    })
}
