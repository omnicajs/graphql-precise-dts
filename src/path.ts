import type { ConfigPaths } from './config'

import {
    dirname,
    isAbsolute,
    join,
    relative,
    resolve,
} from 'path'

const DEFAULT_DOCUMENT_NAME = '*.graphql'

export const GENERATED_ENUMS_FILE_NAME = 'enums'
export const GENERATED_SCHEMA_FILE_NAME = 'schema'

const normalizePath = (value: string): string => value.split('\\').join('/')

const resolveScopeRoot = (scope?: string): string | undefined => {
    if (!scope) return

    const normalizedScope = normalizePath(scope).replace(/\/+$/, '')
    const lastSlashIndex = normalizedScope.lastIndexOf('/')

    if (lastSlashIndex === -1) return normalizedScope

    return normalizedScope.slice(0, lastSlashIndex + 1)
}

const resolveDocumentModulePath = (
    documentLocation: string,
    relativeMode: boolean
): string => {
    if (relativeMode || isAbsolute(documentLocation)) {
        return normalizePath(relative(process.cwd(), documentLocation))
    }

    return normalizePath(documentLocation)
}

const makeRelativeModuleSpecifier = (path: string): string => {
    if (path === DEFAULT_DOCUMENT_NAME) return path
    if (path.startsWith('./') || path.startsWith('../')) return path

    return `./${path}`
}

const stripGeneratedTypeScriptExtension = (path: string): string => path.replace(/(?:\.d)?\.ts$/, '')

const normalizeOutputPath = (path: string): string => stripGeneratedTypeScriptExtension(normalizePath(resolve(path)))

const normalizeTargetPattern = (pattern: string): string =>
    stripGeneratedTypeScriptExtension(normalizePath(
        isAbsolute(pattern)
            ? pattern
            : resolve(process.cwd(), pattern)
    ))

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const makeWildcardPatternRegExp = (pattern: string): RegExp => new RegExp(
    `^${pattern.split('*').map(escapeRegExp).join('(.+)')}$`
)

const makeAliasedModuleSpecifier = (
    toFile: string,
    paths: ConfigPaths
): string | undefined => {
    const normalizedToFile = normalizeOutputPath(toFile)
    const matches: { specifier: string; score: number }[] = []

    Object.entries(paths).forEach(([ aliasPattern, targets ]) => {
        const targetPatterns = Array.isArray(targets) ? targets : [ targets ]

        targetPatterns.forEach(targetPattern => {
            const normalizedTargetPattern = normalizeTargetPattern(targetPattern)

            if (!normalizedTargetPattern.includes('*')) {
                if (normalizedToFile === normalizedTargetPattern) {
                    matches.push({
                        specifier: stripGeneratedTypeScriptExtension(normalizePath(aliasPattern)),
                        score: normalizedTargetPattern.length,
                    })
                }

                return
            }

            const match = normalizedToFile.match(makeWildcardPatternRegExp(normalizedTargetPattern))
            if (!match) return

            let specifier = stripGeneratedTypeScriptExtension(normalizePath(aliasPattern))
            match.slice(1).forEach(value => {
                specifier = specifier.replace('*', value)
            })

            matches.push({
                specifier,
                score: normalizedTargetPattern.indexOf('*'),
            })
        })
    })

    matches.sort((left, right) => right.score - left.score)

    return matches[0]?.specifier
}

export const makeDeclarationModuleSpecifier = (
    fromFile: string,
    toFile: string,
    paths?: ConfigPaths
): string => paths
    ? makeAliasedModuleSpecifier(toFile, paths) ?? makeDeclarationModuleSpecifier(fromFile, toFile)
    : makeRelativeModuleSpecifier(
        normalizePath(relative(dirname(fromFile), stripGeneratedTypeScriptExtension(toFile)))
    )

export const makeSchemaOutputDirectory = (
    outputFile: string,
    schemaOutputDirectory?: string
): string => {
    const outputDir = dirname(outputFile)

    if (!schemaOutputDirectory) return outputDir

    return isAbsolute(schemaOutputDirectory)
        ? schemaOutputDirectory
        : join(outputDir, schemaOutputDirectory)
}

export const makeSchemaDeclarationOutputFile = (
    directory: string
): string => join(directory, `${GENERATED_SCHEMA_FILE_NAME}.d.ts`)

export const makeEnumsOutputFile = (
    directory: string
): string => join(directory, `${GENERATED_ENUMS_FILE_NAME}.ts`)

export const makeModuleSpecifier = (
    prefix: string,
    documentLocation?: string,
    relativeMode = false,
    scope?: string
): string => {
    if (documentLocation) {
        const normalizedDocumentLocation = normalizePath(documentLocation)
        const scopeRoot = resolveScopeRoot(scope)

        if (scopeRoot) {
            const scopeStartIndex = normalizedDocumentLocation.indexOf(scopeRoot)

            if (scopeStartIndex !== -1) {
                const scopedPath = normalizedDocumentLocation.slice(scopeStartIndex)

                return prefix
                    ? `${prefix}${scopedPath}`
                    : makeRelativeModuleSpecifier(scopedPath)
            }
        }
    }

    const fileName = documentLocation
        ? resolveDocumentModulePath(documentLocation, relativeMode)
        : DEFAULT_DOCUMENT_NAME

    return prefix
        ? `${prefix}${fileName}`
        : makeRelativeModuleSpecifier(fileName)
}
