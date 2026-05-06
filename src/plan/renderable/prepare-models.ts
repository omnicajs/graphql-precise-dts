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

import type { RenderableVariableField } from './shape-types'
import type { RenderableVariableValue } from './value-types'

import { prepareObjectShape } from './shapes'
import { getVariableObjectAliasName } from '../naming'

import { RENDER_STRATEGY } from './kinds'
import {
    FRAGMENT_ROOT_KIND,
    VALUE_MODEL_KIND,
} from '../../kinds'

const prepareRenderableVariableValue = (
    value: PlannedVariableValue,
    aliasedVariableObjectTypeNames: Set<string>
): RenderableVariableValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.SCALAR:
        case VALUE_MODEL_KIND.ENUM:
        case VALUE_MODEL_KIND.UNKNOWN:
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
                    prepareRenderableVariableField(field, aliasedVariableObjectTypeNames)
                ),
            }
    }
}

const prepareRenderableVariableField = (
    field: PlannedVariableField,
    aliasedVariableObjectTypeNames: Set<string>
): RenderableVariableField => ({
    ...field,
    value: prepareRenderableVariableValue(field.value, aliasedVariableObjectTypeNames),
})

const prepareRenderableVariableAlias = (
    alias: PlannedVariableAlias,
    aliasedVariableObjectTypeNames: Set<string>
): RenderableVariableAlias => ({
    ...alias,
    fields: alias.fields.map(field => prepareRenderableVariableField(field, aliasedVariableObjectTypeNames)),
})

const prepareRenderableFragmentModel = (fragment: PlannedFragmentModel): RenderableFragmentModel => ({
    ...fragment,
    root: fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
        ? {
            kind: FRAGMENT_ROOT_KIND.UNION,
            variants: fragment.root.variants.map(variant =>
                prepareObjectShape(variant.fields, [ variant.typeName ])
            ),
        }
        : {
            kind: FRAGMENT_ROOT_KIND.OBJECT,
            shape: prepareObjectShape(fragment.root.fields, fragment.onTypeNames ?? [ fragment.onType ], {
                dedupeTypenameWithSpread: true,
                dedupeTypenameWithAlias: (fragment.onTypeNames ?? [ fragment.onType ]).length === 1,
            }),
        },
})

const prepareRenderableOperationModel = (
    operation: PlannedOperationModel,
    aliasedVariableObjectTypeNames: Set<string>
): RenderableOperationModel => ({
    ...operation,
    variables: operation.variables.map(field => prepareRenderableVariableField(field, aliasedVariableObjectTypeNames)),
    resultShape: prepareObjectShape(operation.result, [ operation.onType ], {
        dedupeTypenameWithAlias: true,
    }),
})

const prepareRenderableOutputAlias = ({ aliasName, fields, typeNames, renderOptions }: PlannedOutputAlias): RenderableOutputAlias => ({
    aliasName,
    shape: prepareObjectShape(fields, typeNames, renderOptions),
})

export const prepareRenderableDocumentModels = (
    models: PlannedDocumentModels
): RenderableDocumentModels => {
    const aliasedVariableObjectTypeNames = new Set(models.variableAliases.map(alias => alias.typeName))

    return {
        fragments: new Map(
            [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
                name,
                prepareRenderableFragmentModel(fragment),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                prepareRenderableOperationModel(operation, aliasedVariableObjectTypeNames),
            ])
        ),
        variableAliases: models.variableAliases.map(alias =>
            prepareRenderableVariableAlias(alias, aliasedVariableObjectTypeNames)
        ),
        outputAliases: models.outputAliases.map(prepareRenderableOutputAlias),
    }
}
