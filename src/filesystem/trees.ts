import type {
    DeclarationFile,
    DeclarationTree,
    OutputManifest,
    PreparedDeclarationTree,
} from './types'

import { isRecord } from '@/predicates'
import {
    OUTPUT_MANIFEST_FILE,
    parseOutputManifest,
} from './manifest'
import { readFileSync } from 'node:fs'
import {
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path'

const isOutside = (path: string): boolean => path === '..'
    || path.startsWith(`..${sep}`)
    || isAbsolute(path)

export const resolveOwnedFile = (
    root: string,
    path: string,
    manifestFile: string
): string => {
    const absoluteFile = resolve(root, path)
    const relativeFile = relative(root, absoluteFile)

    if (!relativeFile || isOutside(relativeFile) || absoluteFile === manifestFile) {
        throw new Error(`Output manifest "${manifestFile}" contains an unsafe path: ${path}`)
    }

    return absoluteFile
}

const readOutputManifest = (file: string): OutputManifest | undefined => {
    try {
        return parseOutputManifest(readFileSync(file, 'utf8'), file)
    } catch (error) {
        if (isRecord(error) && error.code === 'ENOENT') return

        throw error
    }
}

export const prepareDeclarationTrees = (
    root: string,
    trees: ReadonlyArray<DeclarationTree>
): ReadonlyArray<PreparedDeclarationTree> => {
    const grouped = new Map<string, DeclarationFile[]>()

    for (const tree of trees) {
        const absoluteRoot = resolve(root, tree.root)
        const files = grouped.get(absoluteRoot) ?? []
        files.push(...tree.files)
        grouped.set(absoluteRoot, files)
    }

    return [ ...grouped ]
        .sort(([ left ], [ right ]) => left.localeCompare(right))
        .map(([ treeRoot, files ]) => {
            const manifestFile = resolve(treeRoot, OUTPUT_MANIFEST_FILE)

            return {
                root: treeRoot,
                manifestFile,
                previousManifest: readOutputManifest(manifestFile),
                files: files.map(file => {
                    const absoluteFile = resolve(root, file.file)
                    const path = relative(treeRoot, absoluteFile)

                    return { ...file, absoluteFile, path: path.split(sep).join('/') }
                }),
            }
        })
}
