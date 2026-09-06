import type { NamingConvention } from '../naming'
import type { PlannedDocument } from './types'
import type { SourceLocation } from '../types'

import { invalidDocument } from '../errors'
import { uncapitalize } from '@/strings'

const register = (
    names: Map<string, string>,
    kind: 'type' | 'runtime',
    name: string,
    owner: string,
    location: SourceLocation
): void => {
    const existingOwner = names.get(name)
    if (existingOwner) {
        return invalidDocument(
            `Generated ${kind} name "${name}" is used by both ${existingOwner} and ${owner}`,
            location
        )
    }

    names.set(name, owner)
}

export const validateNames = (
    document: PlannedDocument,
    naming: NamingConvention
): void => {
    const typeNames = new Map<string, string>()
    const runtimeNames = new Map<string, string>()

    for (const plannedImport of document.imports) {
        for (const name of plannedImport.names) {
            const owner = `import from "${plannedImport.source}"`

            register(typeNames, 'type', name, owner, plannedImport.location)
            register(runtimeNames, 'runtime', name, owner, plannedImport.location)
        }
    }

    for (const definition of document.definitions) {
        if (definition.kind === 'fragment') {
            register(
                typeNames,
                'type',
                naming.fragmentName(definition.name),
                `fragment "${definition.name}"`,
                definition.location
            )
            continue
        }

        register(
            typeNames,
            'type',
            naming.operationVariablesTypeName(definition.name, definition.operation),
            `operation "${definition.name}" variables`,
            definition.location
        )
        register(
            typeNames,
            'type',
            naming.operationPayloadTypeName(definition.name, definition.operation),
            `operation "${definition.name}" payload`,
            definition.location
        )
        register(
            runtimeNames,
            'runtime',
            uncapitalize(naming.operationTypeName(definition.name, definition.operation)),
            `operation "${definition.name}" export`,
            definition.location
        )
    }
}
