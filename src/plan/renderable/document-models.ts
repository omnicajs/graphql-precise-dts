import type {
    PlannedDocumentModels,
    PlannedFragmentModel,
    PlannedOperationModel,
    PlannedOutputAlias,
    PlannedVariableAlias,
} from '../planned/types'

import type { RenderableObjectShape } from './types'

import { prepareObjectShape } from './shapes'

import { FRAGMENT_ROOT_KIND } from '../../kinds'

export type RenderableFragmentModel = Omit<PlannedFragmentModel, 'root'> & {
    root: {
        kind: typeof FRAGMENT_ROOT_KIND.OBJECT;
        shape: RenderableObjectShape;
    } | {
        kind: typeof FRAGMENT_ROOT_KIND.UNION;
        variants: RenderableObjectShape[];
    };
}

export type RenderableOperationModel = Omit<PlannedOperationModel, 'result'> & {
    resultShape: RenderableObjectShape;
}

export type RenderableOutputAlias = {
    aliasName: string;
    shape: RenderableObjectShape;
}

export type RenderableDocumentModels = {
    fragments: Map<string, RenderableFragmentModel>;
    operations: Map<string, RenderableOperationModel>;
    variableAliases: PlannedVariableAlias[];
    outputAliases: RenderableOutputAlias[];
}

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

const prepareRenderableOperationModel = (operation: PlannedOperationModel): RenderableOperationModel => ({
    ...operation,
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
): RenderableDocumentModels => ({
    fragments: new Map(
        [ ...models.fragments.entries() ].map(([ name, fragment ]) => [
            name,
            prepareRenderableFragmentModel(fragment),
        ])
    ),
    operations: new Map(
        [ ...models.operations.entries() ].map(([ name, operation ]) => [
            name,
            prepareRenderableOperationModel(operation),
        ])
    ),
    variableAliases: models.variableAliases,
    outputAliases: models.outputAliases.map(prepareRenderableOutputAlias),
})
