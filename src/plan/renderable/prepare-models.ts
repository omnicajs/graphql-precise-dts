import type { RenderableVariableField } from './shape-types'
import type { RenderableVariableValue } from './value-types'
import type { WarningReporter } from '../warnings'

import type {
    PlannedFragmentModel,
    PlannedOperationModel,
    PlannedOutputAlias,
    PlannedVariableAlias,
    PlannedVariableField,
    PlannedVariableValue,
    PlannedDocumentModels,
} from '../planned/types'

import type {
    RenderableDocumentModels,
    RenderableFragmentModel,
    RenderableOperationModel,
    RenderableOutputAlias,
    RenderableVariableAlias,
} from './model-types'

import { prepareObjectShape } from './shapes'
import { getVariableObjectAliasName } from '../naming'

import { RENDER_STRATEGY } from './kinds'
import {
    FRAGMENT_ROOT_KIND,
    VALUE_MODEL_KIND,
} from '../../kinds'

const prepareRenderableVariableValue = (
    value: PlannedVariableValue,
    aliasedVariableObjectTypeNames: Set<string>,
    reportWarning: WarningReporter
): RenderableVariableValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
        case VALUE_MODEL_KIND.ENUM:
            return value
        case VALUE_MODEL_KIND.UNKNOWN:
            reportWarning('Unknown variable type')
            return value
        case VALUE_MODEL_KIND.OBJECT:
            if (value.renderAsReference && value.renderAliasName) {
                return {
                    kind: value.kind,
                    renderStrategy: RENDER_STRATEGY.REFERENCE,
                    referenceName: value.renderAliasName,
                }
            } else if (value.typeName && aliasedVariableObjectTypeNames.has(value.typeName)) {
                return {
                    kind: value.kind,
                    renderStrategy: RENDER_STRATEGY.REFERENCE,
                    referenceName: getVariableObjectAliasName(value.typeName),
                }
            }

            return {
                kind: value.kind,
                renderStrategy: RENDER_STRATEGY.INLINE,
                fields: value.fields.map(field =>
                    prepareRenderableVariableField(field, aliasedVariableObjectTypeNames, reportWarning)
                ),
            }
    }
}

const prepareRenderableVariableField = (
    field: PlannedVariableField,
    aliasedVariableObjectTypeNames: Set<string>,
    reportWarning: WarningReporter
): RenderableVariableField => ({
    ...field,
    value: prepareRenderableVariableValue(field.value, aliasedVariableObjectTypeNames, reportWarning),
})

const prepareRenderableVariableAlias = (
    alias: PlannedVariableAlias,
    aliasedVariableObjectTypeNames: Set<string>,
    reportWarning: WarningReporter
): RenderableVariableAlias => ({
    ...alias,
    fields: alias.fields.map(field => prepareRenderableVariableField(field, aliasedVariableObjectTypeNames, reportWarning)),
})

const prepareRenderableFragmentModel = (
    fragment: PlannedFragmentModel,
    reportWarning: WarningReporter
): RenderableFragmentModel => ({
    ...fragment,
    root: fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
        ? {
            kind: FRAGMENT_ROOT_KIND.UNION,
            variants: fragment.root.variants.map(variant =>
                prepareObjectShape(variant.fields, [ variant.typeName ], {}, reportWarning)
            ),
        }
        : {
            kind: FRAGMENT_ROOT_KIND.OBJECT,
            shape: prepareObjectShape(fragment.root.fields, fragment.onTypeNames ?? [ fragment.onType ], {
                dedupeTypenameWithSpread: true,
                dedupeTypenameWithAlias: (fragment.onTypeNames ?? [ fragment.onType ]).length === 1,
            }, reportWarning),
        },
})

const prepareRenderableOperationModel = (
    operation: PlannedOperationModel,
    aliasedVariableObjectTypeNames: Set<string>,
    reportWarning: WarningReporter
): RenderableOperationModel => ({
    ...operation,
    variables: operation.variables.map(field =>
        prepareRenderableVariableField(field, aliasedVariableObjectTypeNames, reportWarning)
    ),
    resultShape: prepareObjectShape(operation.result, [ operation.onType ], {
        dedupeTypenameWithAlias: true,
    }, reportWarning),
})

const prepareRenderableOutputAlias = (
    { aliasName, fields, typeNames, renderOptions }: PlannedOutputAlias,
    reportWarning: WarningReporter
): RenderableOutputAlias => ({
    aliasName,
    shape: prepareObjectShape(fields, typeNames, renderOptions, reportWarning),
})

export const prepareRenderableDocumentModels = (
    models: PlannedDocumentModels,
    reportWarning: WarningReporter = message => console.warn(message)
): RenderableDocumentModels => {
    const aliasedVariableObjectTypeNames = new Set(models.variableAliases.map(alias => alias.typeName))

    return {
        fragments: new Map(
            [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
                name,
                prepareRenderableFragmentModel(fragment, reportWarning),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                prepareRenderableOperationModel(operation, aliasedVariableObjectTypeNames, reportWarning),
            ])
        ),
        variableAliases: models.variableAliases.map(alias =>
            prepareRenderableVariableAlias(alias, aliasedVariableObjectTypeNames, reportWarning)
        ),
        outputAliases: models.outputAliases.map(alias => prepareRenderableOutputAlias(alias, reportWarning)),
    }
}
