import type { DocumentModelBundle } from '../plan/document-model-bundles'
import type { NamingConvention } from '../naming'
import type { RenderableDocumentModels } from '../plan/renderable/types'

import { getOperationTypeName } from '../plan/naming'
import { uncapitalize } from '../lib/strings'

const DECLARATION_NAME_SOURCE_KIND = {
    TYPE_IMPORT: 'typeImport',
    FRAGMENT: 'fragment',
    VARIABLE_ALIAS: 'variableAlias',
    OUTPUT_ALIAS: 'outputAlias',
    OPERATION_PAYLOAD: 'operationPayload',
    OPERATION_VARIABLES: 'operationVariables',
    OPERATION_VALUE: 'operationValue',
} as const

type ExportNameSource = {
    kind: typeof DECLARATION_NAME_SOURCE_KIND[keyof typeof DECLARATION_NAME_SOURCE_KIND];
    name: string;
}

const EXACT_TYPE_NAME = 'Exact'

const describeExportNameSource = (source: ExportNameSource): string => {
    switch (source.kind) {
        case DECLARATION_NAME_SOURCE_KIND.TYPE_IMPORT:
            return `imported type "${source.name}"`
        case DECLARATION_NAME_SOURCE_KIND.FRAGMENT:
            return `fragment "${source.name}"`
        /* v8 ignore next -- @preserve variable alias collisions are prevented by NameAllocator */
        case DECLARATION_NAME_SOURCE_KIND.VARIABLE_ALIAS:
            return `generated variable alias "${source.name}"`
        /* v8 ignore next -- @preserve output alias collisions are prevented by NameAllocator */
        case DECLARATION_NAME_SOURCE_KIND.OUTPUT_ALIAS:
            return `generated output alias "${source.name}"`
        case DECLARATION_NAME_SOURCE_KIND.OPERATION_PAYLOAD:
            return `generated payload type "${source.name}"`
        case DECLARATION_NAME_SOURCE_KIND.OPERATION_VARIABLES:
            return `generated variables type "${source.name}"`
        /* v8 ignore next -- @preserve operation value collisions are preceded by operation type-name collisions */
        case DECLARATION_NAME_SOURCE_KIND.OPERATION_VALUE:
            return `generated document export "${source.name}"`
    }
}

const assertUniqueExportName = (
    usedNames: Map<string, ExportNameSource>,
    source: ExportNameSource,
    location: string
) => {
    const existingSource = usedNames.get(source.name)
    if (existingSource) {
        throw new Error(
            `Name collision detected in generated declaration exports for "${location}": `
            + `"${source.name}" is used both by ${describeExportNameSource(existingSource)} `
            + `and by ${describeExportNameSource(source)}.`
        )
    }

    usedNames.set(source.name, source)
}

export const assertUniqueDocumentModuleSpecifiers = (
    documentBundles: DocumentModelBundle[],
    documentModuleSpecifier: (location: string | undefined) => string
) => {
    const moduleLocations = new Map<string, string>()

    documentBundles.forEach(({ models, location }) => {
        if (!models.fragments.size && !models.operations.size) return

        const moduleSpecifier = documentModuleSpecifier(location)
        const existingLocation = moduleLocations.get(moduleSpecifier)
        if (existingLocation) {
            throw new Error(
                `Document module specifier collision detected: "${existingLocation}" and "${location}" both resolve to "${moduleSpecifier}". `
                + 'Adjust the plugin prefix, scope, or document locations so each generated declaration module is unique.'
            )
        }

        moduleLocations.set(moduleSpecifier, location)
    })
}

export const validateDocumentBundleExportNames = (
    location: string,
    imports: Map<string, string>,
    models: RenderableDocumentModels,
    naming: NamingConvention
) => {
    const usedTypeNames = new Map<string, ExportNameSource>()
    const usedValueNames = new Map<string, ExportNameSource>()

    imports.forEach((_, name) => {
        assertUniqueExportName(usedTypeNames, { kind: DECLARATION_NAME_SOURCE_KIND.TYPE_IMPORT, name }, location)
    })

    if ([ ...models.operations.values() ].some(({ variables }) => variables.length > 0)) {
        assertUniqueExportName(usedTypeNames, { kind: DECLARATION_NAME_SOURCE_KIND.TYPE_IMPORT, name: EXACT_TYPE_NAME }, location)
    }

    models.variableAliases.forEach(({ aliasName }) => {
        assertUniqueExportName(usedTypeNames, { kind: DECLARATION_NAME_SOURCE_KIND.VARIABLE_ALIAS, name: aliasName }, location)
    })

    models.outputAliases.forEach(({ aliasName }) => {
        assertUniqueExportName(usedTypeNames, { kind: DECLARATION_NAME_SOURCE_KIND.OUTPUT_ALIAS, name: aliasName }, location)
    })

    models.fragments.forEach((_, name) => {
        assertUniqueExportName(usedTypeNames, {
            kind: DECLARATION_NAME_SOURCE_KIND.FRAGMENT,
            name: naming.fragmentName(name),
        }, location)
    })

    models.operations.forEach((operation, key) => {
        const operationTypeName = getOperationTypeName(key, operation.operationType, naming)

        assertUniqueExportName(
            usedTypeNames,
            {
                kind: DECLARATION_NAME_SOURCE_KIND.OPERATION_VARIABLES,
                name: naming.operationVariablesTypeName(key, operation.operationType),
            },
            location
        )
        assertUniqueExportName(
            usedTypeNames,
            {
                kind: DECLARATION_NAME_SOURCE_KIND.OPERATION_PAYLOAD,
                name: naming.operationPayloadTypeName(key, operation.operationType),
            },
            location
        )
        assertUniqueExportName(
            usedValueNames,
            { kind: DECLARATION_NAME_SOURCE_KIND.OPERATION_VALUE, name: uncapitalize(operationTypeName) },
            location
        )
    })
}
