import type { TsType } from '../../ts-type'

import type {
    RenderableObjectShape,
    RenderableUnionShape,
    RenderableVariableField,
} from './shape-types'

import type { RENDER_STRATEGY } from './kinds'

import { VALUE_MODEL_KIND } from '../../kinds'

export type RenderableFieldValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: TsType }
    | { kind: typeof VALUE_MODEL_KIND.TYPENAME; typeNames: string[] }
    | { kind: typeof VALUE_MODEL_KIND.ENUM; name: string }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        renderStrategy: typeof RENDER_STRATEGY.REFERENCE;
        referenceName: string;
    }
    | {
        kind: typeof VALUE_MODEL_KIND.UNION;
        shape: RenderableUnionShape;
    }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        renderStrategy: typeof RENDER_STRATEGY.INLINE;
        shape: RenderableObjectShape;
    }
    | { kind: typeof VALUE_MODEL_KIND.UNKNOWN; reason: string }

export type RenderableVariableValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: TsType }
    | { kind: typeof VALUE_MODEL_KIND.ENUM; name: string }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        renderStrategy: typeof RENDER_STRATEGY.REFERENCE;
        referenceName: string;
    }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        renderStrategy: typeof RENDER_STRATEGY.INLINE;
        fields: RenderableVariableField[];
    }
    | { kind: typeof VALUE_MODEL_KIND.UNKNOWN; reason: string }
