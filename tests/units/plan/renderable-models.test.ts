import type { PlannedDocumentModels } from '../../../src/plan/planned/types'

import {
    describe,
    expect,
    test,
} from 'vitest'

import { namedType } from '../../fixtures/builders/declaration-render'
import { prepareRenderableDocumentModels } from '../../../src/plan/renderable/prepare-models'

import { OperationTypeNode } from 'graphql'
import { RENDER_STRATEGY } from '../../../src/plan/renderable/kinds'
import { VALUE_MODEL_KIND } from '../../../src/kinds'

describe('renderable model preparation', () => {
    test('uses variable aliases for matching object variable type names', () => {
        const models: PlannedDocumentModels = {
            fragments: new Map(),
            operations: new Map([
                ['CreateTree', {
                    operationType: OperationTypeNode.MUTATION,
                    onType: 'Mutation',
                    result: [],
                    variables: [{
                        name: 'input',
                        typeRef: namedType(false),
                        value: {
                            kind: VALUE_MODEL_KIND.OBJECT,
                            typeName: 'TreeInput',
                            fields: [],
                        },
                    }],
                }],
            ]),
            variableAliases: [{
                typeName: 'TreeInput',
                aliasName: 'TreeInputAlias',
                fields: [],
            }],
            outputAliases: [],
        }

        expect(prepareRenderableDocumentModels(models).operations.get('CreateTree')?.variables[0]?.value).toEqual({
            kind: VALUE_MODEL_KIND.OBJECT,
            renderStrategy: RENDER_STRATEGY.REFERENCE,
            referenceName: 'TreeInputAlias',
        })
    })

    test('keeps object variables inline when their type name has no variable alias', () => {
        const models: PlannedDocumentModels = {
            fragments: new Map(),
            operations: new Map([
                ['CreateTree', {
                    operationType: OperationTypeNode.MUTATION,
                    onType: 'Mutation',
                    result: [],
                    variables: [{
                        name: 'input',
                        typeRef: namedType(false),
                        value: {
                            kind: VALUE_MODEL_KIND.OBJECT,
                            typeName: 'TreeInput',
                            fields: [],
                        },
                    }],
                }],
            ]),
            variableAliases: [],
            outputAliases: [],
        }

        expect(prepareRenderableDocumentModels(models).operations.get('CreateTree')?.variables[0]?.value).toEqual({
            kind: VALUE_MODEL_KIND.OBJECT,
            renderStrategy: RENDER_STRATEGY.INLINE,
            fields: [],
        })
    })
})
