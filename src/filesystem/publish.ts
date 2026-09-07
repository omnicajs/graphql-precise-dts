import type {
    DeclarationTree,
} from './types'

import {
    makeContentHash,
    makeOutputManifest,
    renderOutputManifest,
} from './manifest'
import {
    prepareDeclarationTrees,
    resolveOwnedFile,
} from './trees'
import { writeAtomically } from './write'
import {
    existsSync,
    readFileSync,
    rmSync,
} from 'node:fs'

export const publishDeclarationTrees = (
    root: string,
    trees: ReadonlyArray<DeclarationTree>,
    force: boolean
): void => {
    const preparedTrees = prepareDeclarationTrees(root, trees)
    const plannedFiles = new Set(preparedTrees.flatMap(tree => tree.files.map(file => file.absoluteFile)))
    const ownedFiles = new Set<string>()

    for (const tree of preparedTrees) {
        for (const file of tree.previousManifest?.files ?? []) {
            const absoluteFile = resolveOwnedFile(tree.root, file.path, tree.manifestFile)
            ownedFiles.add(absoluteFile)
            if (force || !existsSync(absoluteFile)) continue

            const contentHash = makeContentHash(readFileSync(absoluteFile, 'utf8'))
            if (contentHash !== file.contentHash) {
                throw new Error(`Output file "${absoluteFile}" was modified after publication`)
            }
        }
    }

    for (const tree of preparedTrees) {
        for (const file of tree.files) {
            if (existsSync(file.absoluteFile) && !ownedFiles.has(file.absoluteFile)) {
                throw new Error(`Output file "${file.absoluteFile}" is not owned by the declaration tree`)
            }
        }
    }

    for (const tree of preparedTrees) {
        for (const file of tree.files) writeAtomically(file.absoluteFile, file.content)
    }

    for (const tree of preparedTrees) {
        for (const file of tree.previousManifest?.files ?? []) {
            const absoluteFile = resolveOwnedFile(tree.root, file.path, tree.manifestFile)
            if (!plannedFiles.has(absoluteFile)) rmSync(absoluteFile, { force: true })
        }
    }

    for (const tree of preparedTrees) {
        writeAtomically(
            tree.manifestFile,
            renderOutputManifest(makeOutputManifest(tree.files))
        )
    }
}
