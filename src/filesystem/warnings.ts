import type { PublicationWarning } from '@/types'
import type { PreparedDeclarationTree } from './types'

import { existsSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

export const findPublicationWarnings = (
    root: string,
    trees: ReadonlyArray<PreparedDeclarationTree>,
    ownedFiles: ReadonlySet<string>
): ReadonlyArray<PublicationWarning> => {
    const roots = new Set(trees.map(tree => tree.root))
    const knownFiles = new Set([
        ...ownedFiles,
        ...trees.map(tree => tree.manifestFile),
        ...trees.flatMap(tree => tree.files.map(file => file.absoluteFile)),
    ])
    const relativePath = (file: string): string => relative(root, file).split(sep).join('/') || '.'

    return trees.flatMap(tree => {
        const files: string[] = []
        const visit = (directory: string): void => {
            if (!existsSync(directory)) return

            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const file = resolve(directory, entry.name)
                if (roots.has(file)) continue
                if (entry.isDirectory()) {
                    visit(file)
                } else if (!knownFiles.has(file)) {
                    files.push(relativePath(file))
                }
            }
        }
        visit(tree.root)

        return files.length ? [{
            code: 'dirty-output' as const,
            root: relativePath(tree.root),
            files: files.sort(),
        }] : []
    })
}
