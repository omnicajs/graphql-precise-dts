import {
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path'

const normalizePath = (path: string): string => path.split(sep).join('/')

const isOutside = (path: string): boolean => path === '..'
    || path.startsWith(`..${sep}`)
    || isAbsolute(path)

export const makeOutputRoot = (
    root: string,
    outputRoot: string
): string => {
    const absoluteRoot = resolve(root, outputRoot)
    const relativeRoot = relative(root, absoluteRoot)

    if (isOutside(relativeRoot)) {
        throw new Error(`Output root must be inside the configuration root: ${outputRoot}`)
    }

    return normalizePath(relativeRoot) || '.'
}

export const makeOutputFile = (
    root: string,
    outputRoot: string,
    sourceId: string
): string => normalizePath(relative(
    root,
    resolve(root, makeOutputRoot(root, outputRoot), `${sourceId}.d.ts`)
))

export const makeNestedOutputFile = (
    root: string,
    outputRoot: string,
    file: string
): string => {
    const normalizedRoot = makeOutputRoot(root, outputRoot)
    const absoluteRoot = resolve(root, normalizedRoot)
    const absoluteFile = resolve(absoluteRoot, file)
    const nestedFile = relative(absoluteRoot, absoluteFile)
    if (!nestedFile || isOutside(nestedFile)) {
        throw new Error(`Output file must be inside its output root: ${file}`)
    }

    return normalizePath(relative(root, absoluteFile))
}
