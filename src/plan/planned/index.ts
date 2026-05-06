import type { CustomScalarMappings } from '../../scalars/types'
import type { CollectedDocumentModels } from '../../models/types'
import type { GenerationDirectivePolicies } from '../../directives/types'
import type { PlannedDocumentModels } from './types'
import type { WarningReporter } from '../warnings'

import { buildOperationModel } from './operation-planner'
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
    reservedNames: string[] = [],
    customScalars: CustomScalarMappings = {},
    directivePolicies: GenerationDirectivePolicies = {},
    reportWarning: WarningReporter = message => console.warn(message)
): PlannedDocumentModels => {
    const outputBuildState = createOutputBuildState()
    const variableBuildState = createVariableBuildState()

    const reservedAliasNames = new Set([
        ...reservedNames,
        ...models.fragments.keys(),
        ...[ ...models.operations.entries() ]
            .map(([ key, operation ]) => getOperationTypeName(key, operation.operationType)),
    ])

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
        outputAliases: buildOutputAliases(outputBuildState.occurrences, reservedAliasNames),
    }
}
