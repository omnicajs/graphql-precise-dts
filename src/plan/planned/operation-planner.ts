import type { CustomScalarMappingRecord } from '../../scalars/types'
import type { GenerationDirectivePolicies } from '../../directives/types'
import type { OperationModel } from '../../models/types'
import type { OutputBuildState, PlannedOperationModel } from './types'
import type { VariableBuildState } from './variable-planner'
import type { WarningReporter } from '../warnings'

import { buildSelection } from './output-planner'
import { buildVariableField } from './variable-planner'
import { normalizeSelections } from './normalize/selection'

export const buildOperationModel = (
    operation: OperationModel,
    outputState: OutputBuildState,
    variableState: VariableBuildState,
    customScalars: CustomScalarMappingRecord,
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: WarningReporter
): PlannedOperationModel => {
    return {
        ...operation,
        variables: operation.variables.map(variable =>
            buildVariableField(variable, variableState, customScalars)
        ),
        result: normalizeSelections(operation.result).map(selection =>
            buildSelection(selection, outputState, customScalars, directivePolicies, reportWarning)
        ),
    }
}
