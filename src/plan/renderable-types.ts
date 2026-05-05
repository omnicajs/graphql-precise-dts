import type { TsType } from '../ts-type'
import type { TypeRef } from '../models/types'

import { VALUE_MODEL_KIND } from '../kinds'

type RenderableTypename = {
    typeNames: string[];
    required: boolean;
}

type RenderableSpread = {
    name: string;
    conditional: boolean;
}

type RenderableField = {
    name: string;
    typeRef: TypeRef;
    conditional: boolean;
    value: RenderableFieldValue;
    overrideTypeTs?: TsType;
}

export type RenderableSelectionSet = {
    rows: RenderableField[];
    spreads: RenderableSpread[];
}

export type RenderableObjectShape = RenderableSelectionSet & {
    typename?: RenderableTypename;
}

export type RenderableUnionShape = {
    kind: 'collapsed';
    typename: RenderableTypename;
    rows: RenderableField[];
    spreads: RenderableSpread[];
} | {
    kind: 'variants';
    variants: RenderableObjectShape[];
}

export type RenderableFieldValue =
    | { kind: typeof VALUE_MODEL_KIND.SCALAR; typeTs: TsType }
    | { kind: typeof VALUE_MODEL_KIND.TYPENAME; typeNames: string[] }
    | { kind: typeof VALUE_MODEL_KIND.ENUM; name: string }
    | {
        kind: typeof VALUE_MODEL_KIND.OBJECT;
        renderAliasName?: string;
        renderAsReference?: boolean;
        shape?: RenderableObjectShape;
    }
    | {
        kind: typeof VALUE_MODEL_KIND.UNION;
        shape: RenderableUnionShape;
    }
    | { kind: typeof VALUE_MODEL_KIND.UNKNOWN; reason: string }
