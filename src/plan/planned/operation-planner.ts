import type { CustomScalarMappings } from '../../scalars/types'
import type { GenerationDirectivePolicies } from '../../directives/types'
import type { OperationModel } from '../../models/types'
import type {
    OutputBuildState,
    PlannedOperationModel,
    PlannedWarningReporter,
} from './types'
import type { VariableBuildState } from './variable-planner'

import { buildSelection } from './output-planner'
import { buildVariableField } from './variable-planner'
import { getOperationTypeName } from '../naming'
import { normalizeSelections } from './normalize/selection'

export const buildOperationModel = (
    operationName: string,
    operation: OperationModel,
    outputState: OutputBuildState,
    variableState: VariableBuildState,
    customScalars: CustomScalarMappings,
    directivePolicies: GenerationDirectivePolicies,
    reportWarning: PlannedWarningReporter
): PlannedOperationModel => {
    const operationTypeName = getOperationTypeName(operationName, operation.operationType)

    return {
        ...operation,
        variables: operation.variables.map(variable =>
            buildVariableField(variable, variableState, customScalars)
        ),
        result: normalizeSelections(operation.result).map(selection =>
            buildSelection(selection, operationTypeName, outputState, customScalars, directivePolicies, reportWarning)
        ),
    }
}
