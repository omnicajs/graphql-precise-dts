import type {
    RenderableDocumentModels,
    RenderableFieldValue,
    RenderableObjectShape,
} from '../../../src/plan/renderable/types'

import { defineString } from '../../../src'
import { namedType } from './declaration-render'

import { RENDER_STRATEGY } from '../../../src/plan/renderable/kinds'
import { VALUE_MODEL_KIND } from '../../../src/kinds'

export const renderableScalarValue = (): RenderableFieldValue => ({
    kind: VALUE_MODEL_KIND.SCALAR,
    typeTs: defineString(),
})

export const renderableReferenceValue = (referenceName: string): RenderableFieldValue => ({
    kind: VALUE_MODEL_KIND.OBJECT,
    renderStrategy: RENDER_STRATEGY.REFERENCE,
    referenceName,
})

export const renderableInlineObjectValue = (
    shape: RenderableObjectShape
): RenderableFieldValue => ({
    kind: VALUE_MODEL_KIND.OBJECT,
    renderStrategy: RENDER_STRATEGY.INLINE,
    shape,
})

export const renderableField = (
    name: string,
    value: RenderableFieldValue
): RenderableObjectShape['rows'][number] => ({
    name,
    typeRef: namedType(false),
    conditional: false,
    value,
})

export const renderableSpreadOnlyShape = (name: string): RenderableObjectShape => ({
    rows: [],
    spreads: [{
        name,
        conditional: false,
    }],
})

export const emptyRenderableModels = (): RenderableDocumentModels => ({
    fragments: new Map(),
    operations: new Map(),
    variableAliases: [],
    outputAliases: [],
})

export const withRenderableImportedAlias = (
    importedShape: RenderableObjectShape,
    models: Partial<RenderableDocumentModels>
): RenderableDocumentModels => ({
    ...emptyRenderableModels(),
    ...models,
    outputAliases: [
        {
            aliasName: 'ImportedAlias',
            shape: importedShape,
        },
        ...(models.outputAliases ?? []),
    ],
})
