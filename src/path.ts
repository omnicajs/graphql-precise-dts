import {
    isAbsolute,
    relative,
} from 'path'

const DEFAULT_DOCUMENT_NAME = '*.graphql'

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
