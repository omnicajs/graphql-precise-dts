import type { DocumentFile } from '../config'
import type {
    DocumentNode,
    FragmentDefinitionNode,
} from 'graphql'

import { dirname } from 'path'
import { existsSync } from 'fs'
import { isAbsolute } from 'path'
import { parse } from 'graphql'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { visit } from 'graphql'

import { Kind } from 'graphql'

type RecoveryQueueEntry = {
    documentFile: DocumentFile & { location: string };
    neededFragmentNames: Set<string>;
}

const GRAPHQL_IMPORT_PATTERN = /^\s*#import\s+['"](.+?)['"]/gm

export const collectFragmentDefinitions = (
    documents: DocumentFile[]
): Map<string, FragmentDefinitionNode> => {
    const fragments = new Map<string, FragmentDefinitionNode>()

    documents.forEach(({ document }) => {
        if (!document) return

        visit(document, {
            FragmentDefinition(node) {
                if (!fragments.has(node.name.value)) {
                    fragments.set(node.name.value, node)
                }
            },
        })
    })

    return fragments
}

export const collectFragmentSpreadNames = (document: DocumentNode): string[] => {
    const fragmentSpreadNames = new Set<string>()

    visit(document, {
        FragmentSpread(node) {
            fragmentSpreadNames.add(node.name.value)
        },
    })

    return [ ...fragmentSpreadNames ]
}

const hasLocation = (
    documentFile: DocumentFile
): documentFile is DocumentFile & { location: string } => typeof documentFile.location === 'string'

const resolveDocumentPath = (location: string): string => isAbsolute(location)
    ? location
    : resolve(process.cwd(), location)

const collectImportedDocumentPaths = (location: string): string[] => {
    const documentPath = resolveDocumentPath(location)
    if (!existsSync(documentPath)) return []

    return [ ...readFileSync(documentPath, 'utf8').matchAll(GRAPHQL_IMPORT_PATTERN) ]
        .map(([, importPath ]) => resolve(dirname(documentPath), importPath))
}

const makeFragmentOnlyDocument = (documentPath: string): DocumentFile | undefined => {
    if (!existsSync(documentPath)) return

    const parsed = parse(readFileSync(documentPath, 'utf8'))
    const definitions = parsed.definitions.filter(definition => definition.kind === Kind.FRAGMENT_DEFINITION)
    if (!definitions.length) return

    return {
        location: documentPath,
        document: {
            kind: Kind.DOCUMENT,
            definitions,
        },
    }
}

const makeRecoveryQueue = (documents: DocumentFile[]): RecoveryQueueEntry[] => documents
    .filter(hasLocation)
    .map(documentFile => ({
        documentFile,
        neededFragmentNames: new Set(
            documentFile.document
                ? collectFragmentSpreadNames(documentFile.document)
                : []
        ),
    }))

const findReachableFragmentNames = (
    document: DocumentNode,
    neededFragmentNames: Set<string>
): Set<string> => {
    const definedFragmentNames = document.definitions.flatMap(definition =>
        definition.kind === Kind.FRAGMENT_DEFINITION
            ? [ definition.name.value ]
            : []
    )

    return new Set(
        [ ...definedFragmentNames ]
            .filter(fragmentName => neededFragmentNames.has(fragmentName))
    )
}

const collectNestedNeededFragmentNames = (
    document: DocumentNode,
    reachableFragmentNames: Set<string>
): Set<string> => {
    const nextNeededFragmentNames = new Set<string>()

    document.definitions.forEach(definition => {
        if (
            definition.kind === Kind.FRAGMENT_DEFINITION
            && reachableFragmentNames.has(definition.name.value)
        ) {
            collectFragmentSpreadNames({
                kind: Kind.DOCUMENT,
                definitions: [ definition ],
            }).forEach(fragmentName => nextNeededFragmentNames.add(fragmentName))
        }
    })

    return nextNeededFragmentNames
}

const filterDocumentToReachableFragments = (
    document: DocumentNode,
    reachableFragmentNames: Set<string>
): DocumentNode => ({
    kind: Kind.DOCUMENT,
    definitions: document.definitions.filter(definition =>
        definition.kind === Kind.FRAGMENT_DEFINITION
        && reachableFragmentNames.has(definition.name.value)
    ),
})

const recoverReachableFragmentDocument = (
    importedDocumentPath: string,
    neededFragmentNames: Set<string>
): RecoveryQueueEntry | undefined => {
    const recoveredDocument = makeFragmentOnlyDocument(importedDocumentPath)
    if (!recoveredDocument?.document) return

    const reachableFragmentNames = findReachableFragmentNames(
        recoveredDocument.document,
        neededFragmentNames
    )
    if (!reachableFragmentNames.size) return

    const reachableDocument = filterDocumentToReachableFragments(
        recoveredDocument.document,
        reachableFragmentNames
    )

    return {
        documentFile: {
            ...recoveredDocument,
            document: reachableDocument,
        } as DocumentFile & { location: string },
        neededFragmentNames: collectNestedNeededFragmentNames(
            reachableDocument,
            reachableFragmentNames
        ),
    }
}

export const recoverImportedFragmentDocuments = (
    documents: DocumentFile[]
): DocumentFile[] => {
    const recoveredDocuments: DocumentFile[] = []
    const queue = makeRecoveryQueue(documents)
    const seenPaths = new Set(
        queue.map(({ documentFile }) => resolveDocumentPath(documentFile.location))
    )

    while (queue.length > 0) {
        const { documentFile, neededFragmentNames } = queue.shift()!

        collectImportedDocumentPaths(documentFile.location).forEach(importedDocumentPath => {
            if (seenPaths.has(importedDocumentPath)) return

            const recoveredEntry = recoverReachableFragmentDocument(
                importedDocumentPath,
                neededFragmentNames
            )
            if (!recoveredEntry) return

            seenPaths.add(importedDocumentPath)

            recoveredDocuments.push(recoveredEntry.documentFile)
            queue.push(recoveredEntry)
        })
    }

    return recoveredDocuments
}

export const emitMissingFragmentDefinitionWarnings = (
    documents: DocumentFile[],
    fragmentDefinitions: Map<string, FragmentDefinitionNode>,
    includeRecoveredImports = false
) => {
    documents.forEach(documentFile => {
        if (!documentFile.document) return

        const missingFragmentNames = collectFragmentSpreadNames(documentFile.document)
            .filter(fragmentName => !fragmentDefinitions.has(fragmentName))

        if (!missingFragmentNames.length) return

        missingFragmentNames.forEach(fragmentName => {
            const documentLocation = documentFile.location ?? '<unknown document>'

            console.warn(
                includeRecoveredImports
                    ? `Fragment definition "${fragmentName}" referenced from "${documentLocation}" was not found among the documents configured for the plugin or the imported fragment documents recovered by it.`
                    : `Fragment definition "${fragmentName}" referenced from "${documentLocation}" was not found among the documents configured for the plugin.`
            )
        })
    })
}
