import type { RenderableDocumentModels } from '../../../src/plan/renderable/types'

import {
    describe,
    expect,
    test,
} from 'vitest'

import { deduplicateImportedOutputAliases } from '../../../src/plan/renderable/deduplicate-imported-output-aliases'
import {
    emptyRenderableModels,
    renderableField,
    renderableInlineObjectValue,
    renderableReferenceValue,
    renderableScalarValue,
    renderableSpreadOnlyShape,
    withRenderableImportedAlias,
} from '../../fixtures/builders/renderable-models'

import { OperationTypeNode } from 'graphql'
import {
    RENDER_STRATEGY,
    RENDERABLE_UNION_SHAPE,
} from '../../../src/plan/renderable/kinds'
import {
    FRAGMENT_ROOT_KIND,
    VALUE_MODEL_KIND,
} from '../../../src/kinds'

describe('imported output alias deduplication', () => {
    test('keeps models unchanged when output alias spreads are not imported declarations', () => {
        const models: RenderableDocumentModels = {
            ...emptyRenderableModels(),
            outputAliases: [{
                aliasName: 'LocalAlias',
                shape: renderableSpreadOnlyShape('LocalFragment'),
            }],
        }

        expect(deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )).toBe(models)
    })

    test('inlines duplicate imported output alias references in object fragments', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            fragments: new Map([
                ['UserDetails', {
                    onType: 'User',
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        shape: {
                            rows: [
                                renderableField('imported', renderableReferenceValue('ImportedAlias')),
                                renderableField('local', renderableReferenceValue('LocalAlias')),
                                renderableField('scalar', renderableScalarValue()),
                            ],
                            spreads: [],
                        },
                    },
                }],
            ]),
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )
        const userDetailsRoot = result.fragments.get('UserDetails')?.root

        const rows = userDetailsRoot?.kind === FRAGMENT_ROOT_KIND.OBJECT ? userDetailsRoot.shape.rows : undefined
        expect(rows).not.toBeUndefined()
        expect(rows).toHaveLength(3)

        expect(rows![0]?.value).toEqual(renderableInlineObjectValue(importedShape))
        expect(rows![1]?.value).toEqual(renderableReferenceValue('LocalAlias'))
        expect(rows![2]?.value).toEqual(renderableScalarValue())
    })

    test('inlines duplicate imported output alias references in nested inline object values', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            fragments: new Map([
                ['UserDetails', {
                    onType: 'User',
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        shape: {
                            rows: [
                                renderableField(
                                    'nested',
                                    renderableInlineObjectValue({
                                        rows: [
                                            renderableField('inner', renderableReferenceValue('ImportedAlias')),
                                        ],
                                        spreads: [],
                                    })
                                ),
                            ],
                            spreads: [],
                        },
                    },
                }],
            ]),
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )
        const root = result.fragments.get('UserDetails')?.root
        const nestedValue = root?.kind === FRAGMENT_ROOT_KIND.OBJECT
            ? root.shape.rows[0]?.value
            : undefined

        expect(nestedValue?.kind === VALUE_MODEL_KIND.OBJECT && nestedValue.renderStrategy === RENDER_STRATEGY.INLINE
            ? nestedValue.shape.rows[0]?.value
            : undefined).toEqual(renderableInlineObjectValue(importedShape))
    })

    test('inlines duplicate imported output alias references in collapsed union values', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            fragments: new Map([
                ['UserDetails', {
                    onType: 'User',
                    root: {
                        kind: FRAGMENT_ROOT_KIND.OBJECT,
                        shape: {
                            rows: [
                                renderableField('collapsedUnion', {
                                    kind: VALUE_MODEL_KIND.UNION,
                                    shape: {
                                        kind: RENDERABLE_UNION_SHAPE.COLLAPSED,
                                        typename: {
                                            typeNames: [ 'User' ],
                                            required: true,
                                        },
                                        rows: [
                                            renderableField('unionRef', renderableReferenceValue('ImportedAlias')),
                                        ],
                                        spreads: [],
                                    },
                                }),
                            ],
                            spreads: [],
                        },
                    },
                }],
            ]),
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )
        const root = result.fragments.get('UserDetails')?.root
        const unionValue = root?.kind === FRAGMENT_ROOT_KIND.OBJECT
            ? root.shape.rows[0]?.value
            : undefined

        expect(unionValue?.kind === VALUE_MODEL_KIND.UNION && unionValue.shape.kind === RENDERABLE_UNION_SHAPE.COLLAPSED
            ? unionValue.shape.rows[0]?.value
            : undefined).toEqual(renderableInlineObjectValue(importedShape))
    })

    test('inlines duplicate imported output alias references in union fragment roots', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            fragments: new Map([
                ['SearchResult', {
                    onType: 'SearchResult',
                    root: {
                        kind: FRAGMENT_ROOT_KIND.UNION,
                        variants: [{
                            rows: [
                                renderableField('variantRef', renderableReferenceValue('ImportedAlias')),
                            ],
                            spreads: [],
                        }],
                    },
                }],
            ]),
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )
        const searchResultRoot = result.fragments.get('SearchResult')?.root

        expect(searchResultRoot?.kind === FRAGMENT_ROOT_KIND.UNION
            ? searchResultRoot.variants[0]?.rows[0]?.value
            : undefined).toEqual(renderableInlineObjectValue(importedShape))
    })

    test('inlines duplicate imported output alias references in operation result shapes', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            operations: new Map([
                ['UserQuery', {
                    operationType: OperationTypeNode.QUERY,
                    onType: 'Query',
                    resultShape: {
                        rows: [
                            renderableField('operationRef', renderableReferenceValue('ImportedAlias')),
                        ],
                        spreads: [],
                    },
                    variables: [],
                }],
            ]),
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )

        expect(result.operations.get('UserQuery')?.resultShape.rows[0]?.value).toEqual({
            ...renderableInlineObjectValue(importedShape),
        })
    })

    test('removes duplicate imported output aliases and inlines references in remaining output aliases', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            outputAliases: [{
                aliasName: 'LocalAlias',
                shape: {
                    rows: [
                        renderableField('aliasRef', renderableReferenceValue('ImportedAlias')),
                    ],
                    spreads: [],
                },
            }],
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )

        expect(result.outputAliases).toHaveLength(1)
        expect(result.outputAliases[0]?.aliasName).toBe('LocalAlias')
        expect(result.outputAliases[0]?.shape.rows[0]?.value).toEqual(renderableInlineObjectValue(importedShape))
    })

    test('inlines duplicate imported output alias references in variant union values', () => {
        const importedShape = renderableSpreadOnlyShape('ImportedFragment')
        const models = withRenderableImportedAlias(importedShape, {
            outputAliases: [{
                aliasName: 'LocalAlias',
                shape: {
                    rows: [
                        renderableField('variantUnion', {
                            kind: VALUE_MODEL_KIND.UNION,
                            shape: {
                                kind: RENDERABLE_UNION_SHAPE.VARIANTS,
                                variants: [{
                                    rows: [
                                        renderableField('variantRef', renderableReferenceValue('ImportedAlias')),
                                    ],
                                    spreads: [],
                                }],
                            },
                        }),
                    ],
                    spreads: [],
                },
            }],
        })

        const result = deduplicateImportedOutputAliases(
            models,
            new Set([ 'ImportedFragment' ])
        )
        const unionValue = result.outputAliases[0]?.shape.rows[0]?.value

        expect(unionValue?.kind === VALUE_MODEL_KIND.UNION && unionValue.shape.kind === RENDERABLE_UNION_SHAPE.VARIANTS
            ? unionValue.shape.variants[0]?.rows[0]?.value
            : undefined).toEqual(renderableInlineObjectValue(importedShape))
    })
})
