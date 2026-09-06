import type { DocumentSelector } from '@/config/types'
import type { LoadedDocument } from './types'
import type { GraphQLError } from 'graphql'

import { collectDocumentImports } from './imports'
import { parse } from 'graphql'
import {
    globSync,
    readFileSync,
    statSync,
} from 'node:fs'
import {
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path'

const normalizePath = (path: string): string => path.split(sep).join('/')

const globFiles = (
    root: string,
    patterns: string | ReadonlyArray<string>,
    exclude?: ReadonlyArray<string>
): ReadonlyArray<string> => globSync(patterns, {
    cwd: root,
    exclude,
}).filter(path => statSync(resolve(root, path)).isFile())

const resolveDocumentFile = (root: string, file: string): {
    file: string
    sourceId: string
} => {
    const absoluteFile = resolve(root, file)
    const relativeFile = relative(root, absoluteFile)

    if (relativeFile === '..' || relativeFile.startsWith(`..${sep}`) || isAbsolute(relativeFile)) {
        throw new Error(`Document file must be inside the project root: ${file}`)
    }

    return {
        file: absoluteFile,
        sourceId: normalizePath(relativeFile),
    }
}

const selectDocumentFiles = (
    root: string,
    selector: DocumentSelector
): ReadonlyArray<string> => {
    if ('files' in selector) return selector.files

    if ('glob' in selector) {
        return globFiles(root, selector.glob.include, selector.glob.exclude)
    }

    return globFiles(root, '**/*')
        .filter(path => selector.regexp.test(normalizePath(path)))
}

export const loadDocuments = (
    root: string,
    projectRoot: string,
    selector: DocumentSelector
): ReadonlyArray<LoadedDocument> => {
    const absoluteRoot = resolve(root, projectRoot)
    const files = [ ...new Set(selectDocumentFiles(absoluteRoot, selector)) ].sort()

    return files.map(file => {
        const resolved = resolveDocumentFile(absoluteRoot, file)
        const contents = readFileSync(resolved.file, 'utf8')
        const imports = collectDocumentImports(absoluteRoot, resolved.file, contents)

        try {
            return {
                file: resolved.file,
                id: resolved.sourceId,
                imports,
                document: parse(contents),
            }
        } catch (error) {
            const parseError = error as GraphQLError

            return {
                file: resolved.file,
                id: resolved.sourceId,
                imports,
                error: {
                    message: parseError.message,
                    location: parseError.locations?.[0],
                },
            }
        }
    })
}
