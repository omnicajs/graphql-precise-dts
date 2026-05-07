import type { CustomScalarMappingRecord } from '../../scalars/types'
import type { CollectedDocumentModels } from '../../models/types'
import type { GenerationDirectivePolicies } from '../../directives/types'
import type { PlannedDocumentModels } from './types'
import type { WarningReporter } from '../warnings'

import { buildOperationModel } from './operation-planner'
import { createNameAllocator } from './name-allocator'
import { getOperationTypeName } from '../naming'
import {
    buildVariableAliases,
    createVariableBuildState,
} from './variable-planner'

import {
    buildFragmentModel,
    buildOutputAliases,
    createOutputBuildState,
} from './output-planner'

export const makePlannedDocumentModels = (
    models: CollectedDocumentModels,
    occupiedTypeNames: string[] = [],
    customScalars: CustomScalarMappingRecord = {},
    directivePolicies: GenerationDirectivePolicies = {},
    reportWarning: WarningReporter = message => console.warn(message)
): PlannedDocumentModels => {
    const nameAllocator = createNameAllocator([
        ...occupiedTypeNames,
        ...models.fragments.keys(),
        ...[ ...models.operations.entries() ].flatMap(([ key, operation ]) => {
            const operationTypeName = getOperationTypeName(key, operation.operationType)
            return [
                operationTypeName,
                `${operationTypeName}Variables`,
                `${operationTypeName}Payload`,
            ]
        }),
    ])

    const outputBuildState = createOutputBuildState()
    const variableBuildState = createVariableBuildState(nameAllocator)

    return {
        fragments: new Map(
            [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
                name,
                buildFragmentModel(name, fragment, outputBuildState, customScalars, directivePolicies, reportWarning),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                buildOperationModel(
                    name,
                    operation,
                    outputBuildState,
                    variableBuildState,
                    customScalars,
                    directivePolicies,
                    reportWarning
                ),
            ])
        ),
        variableAliases: buildVariableAliases(models.operations, variableBuildState, customScalars),
        outputAliases: buildOutputAliases(outputBuildState.occurrences, nameAllocator),
    }
}
