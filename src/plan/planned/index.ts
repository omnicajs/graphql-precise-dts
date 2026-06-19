import type { CollectedDocumentModels } from '../../models/types'
import type { CustomScalarMappingRecord } from '../../scalars/types'
import type { GenerationDirectivePolicies } from '../../directives/types'
import type { NamingConvention } from '../../naming'
import type { PlannedDocumentModels } from './types'
import type { WarningReporter } from '../warnings'

import { buildOperationModel } from './operation-planner'
import { createNameAllocator } from './name-allocator'
import { createNamingConvention } from '../../naming'
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
    naming: NamingConvention = createNamingConvention(),
    directivePolicies: GenerationDirectivePolicies = {},
    reportWarning: WarningReporter = message => console.warn(message)
): PlannedDocumentModels => {
    const nameAllocator = createNameAllocator([
        ...occupiedTypeNames,
        ...models.fragments.keys(),
        ...[ ...models.operations.entries() ].flatMap(([ key, operation ]) => {
            const operationTypeName = getOperationTypeName(key, operation.operationType, naming)
            return [
                operationTypeName,
                `${operationTypeName}Variables`,
                `${operationTypeName}Payload`,
            ]
        }),
    ])

    const outputBuildState = createOutputBuildState()
    const variableBuildState = createVariableBuildState(nameAllocator, naming)

    return {
        fragments: new Map(
            [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
                name,
                buildFragmentModel(fragment, outputBuildState, customScalars, naming, directivePolicies, reportWarning),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                buildOperationModel(
                    operation,
                    outputBuildState,
                    variableBuildState,
                    customScalars,
                    naming,
                    directivePolicies,
                    reportWarning
                ),
            ])
        ),
        variableAliases: buildVariableAliases(models.operations, variableBuildState, customScalars),
        outputAliases: buildOutputAliases(outputBuildState.occurrences, nameAllocator),
    }
}
