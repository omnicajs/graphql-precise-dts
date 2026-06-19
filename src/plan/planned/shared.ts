import type { CustomScalarMappingRecord } from '../../scalars/types'
import type { NamingConvention } from '../../naming'

import type {
    FieldValue,
    VariableValue,
} from '../../models/types'

import type {
    PlannedFieldValue,
    PlannedVariableValue,
} from './types'

import { getScalarTsType } from '../../scalars/builder'

import { VALUE_MODEL_KIND } from '../../kinds'

export const buildScalarValue = (
    value: Extract<FieldValue | VariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }>,
    customScalars: CustomScalarMappingRecord
): Extract<PlannedFieldValue | PlannedVariableValue, { kind: typeof VALUE_MODEL_KIND.SCALAR }> => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    typeTs: getScalarTsType(value.name, customScalars, value.usage),
})

export const getSuggestedOutputAliasName = (
    value: FieldValue,
    naming: NamingConvention
): string => {
    if (value.kind === VALUE_MODEL_KIND.OBJECT && value.typeNames?.length === 1) {
        return naming.outputAliasName(value.typeNames[0])
    }

    return 'ObjectAlias'
}
