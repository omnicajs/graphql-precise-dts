import type {
    RenderableDocumentModels,
    RenderableFieldValue,
    RenderableFragmentModel,
    RenderableObjectShape,
    RenderableOperationModel,
    RenderableUnionShape,
} from './types'

import {
    RENDER_STRATEGY,
    RENDERABLE_UNION_SHAPE,
} from './kinds'
import {
    FRAGMENT_ROOT_KIND,
    VALUE_MODEL_KIND,
} from '../../kinds'

const getImportedAliasReplacementShape = (
    aliasShape: RenderableObjectShape,
    importNames: Set<string>
): RenderableObjectShape | undefined => {
    if (aliasShape.typename || aliasShape.rows.length || !aliasShape.spreads.length) return
    if (aliasShape.spreads.some(spread => !importNames.has(spread.name))) return

    return aliasShape
}

const replaceFieldValueReferences = (
    value: RenderableFieldValue,
    aliasReplacements: Map<string, RenderableObjectShape>
): RenderableFieldValue => {
    switch (value.kind) {
        case VALUE_MODEL_KIND.OBJECT: {
            if (value.renderStrategy === RENDER_STRATEGY.REFERENCE) {
                const replacementShape = aliasReplacements.get(value.referenceName)

                return replacementShape
                    ? {
                        kind: VALUE_MODEL_KIND.OBJECT,
                        renderStrategy: RENDER_STRATEGY.INLINE,
                        shape: replacementShape,
                    }
                    : value
            }

            return {
                ...value,
                shape: replaceShapeReferences(value.shape, aliasReplacements),
            }
        }
        case VALUE_MODEL_KIND.UNION:
            return {
                ...value,
                shape: replaceUnionReferences(value.shape, aliasReplacements),
            }
        default:
            return value
    }
}

const replaceShapeReferences = (
    shape: RenderableObjectShape,
    aliasReplacements: Map<string, RenderableObjectShape>
): RenderableObjectShape => ({
    ...shape,
    rows: shape.rows.map(row => ({
        ...row,
        value: replaceFieldValueReferences(row.value, aliasReplacements),
    })),
})

const replaceUnionReferences = (
    shape: RenderableUnionShape,
    aliasReplacements: Map<string, RenderableObjectShape>
): RenderableUnionShape => shape.kind === RENDERABLE_UNION_SHAPE.COLLAPSED
    ? {
        ...shape,
        rows: shape.rows.map(row => ({
            ...row,
            value: replaceFieldValueReferences(row.value, aliasReplacements),
        })),
    }
    : {
        ...shape,
        variants: shape.variants.map(variant => replaceShapeReferences(variant, aliasReplacements)),
    }

const replaceFragmentReferences = (
    fragment: RenderableFragmentModel,
    aliasReplacements: Map<string, RenderableObjectShape>
): RenderableFragmentModel => fragment.root.kind === FRAGMENT_ROOT_KIND.UNION
    ? {
        ...fragment,
        root: {
            ...fragment.root,
            variants: fragment.root.variants.map(variant => replaceShapeReferences(variant, aliasReplacements)),
        },
    }
    : {
        ...fragment,
        root: {
            ...fragment.root,
            shape: replaceShapeReferences(fragment.root.shape, aliasReplacements),
        },
    }

const replaceOperationReferences = (
    operation: RenderableOperationModel,
    aliasReplacements: Map<string, RenderableObjectShape>
): RenderableOperationModel => ({
    ...operation,
    resultShape: replaceShapeReferences(operation.resultShape, aliasReplacements),
})

export const excludeImportedDuplicateOutputAliases = (
    models: RenderableDocumentModels,
    importNames: Set<string>
): RenderableDocumentModels => {
    const aliasReplacements = new Map<string, RenderableObjectShape>()

    models.outputAliases.forEach(alias => {
        const replacementShape = getImportedAliasReplacementShape(alias.shape, importNames)
        if (replacementShape) aliasReplacements.set(alias.aliasName, replacementShape)
    })

    return aliasReplacements.size > 0 ? {
        ...models,
        fragments: new Map(
            [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
                name,
                replaceFragmentReferences(fragment, aliasReplacements),
            ])
        ),
        operations: new Map(
            [ ...models.operations.entries() ].map(([ name, operation ]) => [
                name,
                replaceOperationReferences(operation, aliasReplacements),
            ])
        ),
        outputAliases: models.outputAliases
            .filter(alias => !aliasReplacements.has(alias.aliasName))
            .map(alias => ({
                ...alias,
                shape: replaceShapeReferences(alias.shape, aliasReplacements),
            })),
    } : models
}
