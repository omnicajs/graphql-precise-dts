import type { DocumentModelBundle } from '../plan/document-model-bundles'

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
