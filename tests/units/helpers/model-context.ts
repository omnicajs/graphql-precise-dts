import type { ConfigDirectivePolicies } from '../../../src/directives/types'
import type { FragmentDefinitionNode } from 'graphql'
import type { ModelContext } from '../../../src/models/types'
import type { CustomScalarMappings } from '../../../src/scalars/types'
import type {
    DocumentFile,
    Schema,
} from '../../../src/plugin-types'

import { makeDocumentLocationMap } from '../../../src/lib/documents'
import { makeStructuralDirectivePolicies } from '../../../src/directives/structural-policies'

import { Kind } from 'graphql'

type MakeTestModelContextArgs = {
    schema: Schema
    documents?: DocumentFile[];
    customScalars?: CustomScalarMappings;
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
    directivePolicies = {},
}: MakeTestModelContextArgs): ModelContext => ({
    schema,
    fragmentDefinitions: collectFragmentDefinitions(documents),
    documentLocations: makeDocumentLocationMap(documents),
    structuralDirectivePolicies: makeStructuralDirectivePolicies(directivePolicies),
})
