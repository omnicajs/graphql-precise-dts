import type {
    PlannedFragmentModel,
    PlannedOperationModel,
} from '../planned/types'

import type {
    RenderableObjectShape,
    RenderableVariableField,
} from './shape-types'

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

export type RenderableOperationModel = Omit<PlannedOperationModel, 'result' | 'variables'> & {
    resultShape: RenderableObjectShape;
    variables: RenderableVariableField[];
}

export type RenderableOutputAlias = {
    aliasName: string;
    shape: RenderableObjectShape;
}

export type RenderableVariableAlias = {
    typeName: string;
    aliasName: string;
    fields: RenderableVariableField[];
}

export type RenderableDocumentModels = {
    fragments: Map<string, RenderableFragmentModel>;
    operations: Map<string, RenderableOperationModel>;
    variableAliases: RenderableVariableAlias[];
    outputAliases: RenderableOutputAlias[];
}
