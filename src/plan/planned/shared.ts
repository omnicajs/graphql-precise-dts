import type { CustomScalarMappings } from '../../scalars/types'

import type {
    FieldValue,
    VariableValue,
} from '../../models/types'

import type {
    PlannedFieldValue,
    PlannedVariableValue,
} from './types'

import { getScalarTsType } from '../../scalars/builder'
import { capitalize } from '../../lib/strings'

import { VALUE_MODEL_KIND } from '../../kinds'

export const buildScalarValue = (
    value: Extract<FieldValue | VariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }>,
    customScalars: CustomScalarMappings
): Extract<PlannedFieldValue | PlannedVariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    typeTs: getScalarTsType(value.name, customScalars, value.usage),
})

export const getSuggestedOutputAliasName = (
    parentAliasName: string,
    responseName: string,
    value: FieldValue
): string => {
    if (value.kind === VALUE_MODEL_KIND.OBJECT && value.typeNames?.length === 1) {
        return `${parentAliasName}${capitalize(value.typeNames[0])}`
    }

    return `${parentAliasName}${capitalize(responseName)}`
}
