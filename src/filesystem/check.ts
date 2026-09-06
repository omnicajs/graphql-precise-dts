import type {
    DeclarationDifference,
} from '@/types'
import type { DeclarationTree } from './types'

import {
    makeContentHash,
    makeOutputManifest,
    renderOutputManifest,
} from './manifest'
import {
    prepareDeclarationTrees,
    resolveOwnedFile,
} from './trees'
import {
    existsSync,
    readFileSync,
} from 'node:fs'
import {
    relative,
    sep,
} from 'node:path'

const normalizePath = (path: string): string => path.split(sep).join('/')

export const checkDeclarationTrees = (
    root: string,
    trees: ReadonlyArray<DeclarationTree>
): ReadonlyArray<DeclarationDifference> => {
    const differences: DeclarationDifference[] = []

    for (const tree of prepareDeclarationTrees(root, trees)) {
        const expectedFiles = new Set(tree.files.map(file => file.absoluteFile))
        const ownedFiles = new Map((tree.previousManifest?.files ?? []).map(file => [
            resolveOwnedFile(tree.root, file.path, tree.manifestFile),
            file,
        ]))

        for (const [ absoluteFile, ownedFile ] of ownedFiles) {
            if (!existsSync(absoluteFile)) continue

            const content = readFileSync(absoluteFile, 'utf8')
            if (makeContentHash(content) !== ownedFile.contentHash) {
                differences.push({
                    kind: 'modified',
                    file: normalizePath(relative(root, absoluteFile)),
                })
            } else if (!expectedFiles.has(absoluteFile)) {
                differences.push({
                    kind: 'stale',
                    file: normalizePath(relative(root, absoluteFile)),
                })
            }
        }

        for (const file of tree.files) {
            if (!existsSync(file.absoluteFile)) {
                differences.push({ kind: 'missing', file: file.file })
                continue
            }
            if (!ownedFiles.has(file.absoluteFile)) {
                differences.push({ kind: 'unowned', file: file.file })
                continue
            }
            const content = readFileSync(file.absoluteFile, 'utf8')
            if (content !== file.content
                && makeContentHash(content) === ownedFiles.get(file.absoluteFile)!.contentHash) {
                differences.push({ kind: 'changed', file: file.file })
            }
        }

        const expectedManifest = renderOutputManifest(makeOutputManifest(tree.files))
        const manifestPath = normalizePath(relative(root, tree.manifestFile))
        if (!existsSync(tree.manifestFile)) {
            differences.push({ kind: 'missing', file: manifestPath })
        } else if (readFileSync(tree.manifestFile, 'utf8') !== expectedManifest) {
            differences.push({ kind: 'changed', file: manifestPath })
        }
    }

    return differences.sort((left, right) => left.file.localeCompare(right.file))
}
