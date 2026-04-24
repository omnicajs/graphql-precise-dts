import {
    ConfigDirectivePolicies,
    ConfigScalars,
    DocumentFile,
} from '../../../src/config'
import type { FragmentDefinitionNode } from 'graphql'
import type { ModelContext } from '../../../src/models/types'
import type { Schema } from '../../../src/config'

import { makeDocumentLocationMap } from '../../../src/lib/documents'

import { Kind } from 'graphql'

type MakeTestModelContextArgs = {
    schema: Schema
    documents?: DocumentFile[];
    customScalars?: ConfigScalars;
    directivePolicies?: ConfigDirectivePolicies;
}

const collectFragmentDefinitions = (
    documents: DocumentFile[] = []
): Map<string, FragmentDefinitionNode> => {
    const fragmentDefinitions = new Map<string, FragmentDefinitionNode>()

    documents.forEach(({ document }) => {
        document?.definitions.forEach(definition => {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                fragmentDefinitions.set(definition.name.value, definition)
            }
        })
    })

    return fragmentDefinitions
}

export const makeTestModelContext = ({
    schema,
    documents = [],
    customScalars = {},
    directivePolicies = {},
}: MakeTestModelContextArgs): ModelContext => ({
    schema,
    fragmentDefinitions: collectFragmentDefinitions(documents),
    documentLocations: makeDocumentLocationMap(documents),
    customScalars,
    directivePolicies,
})
