import type { TsType } from '../../ts-type'
import type { TypeRef } from '../../models/types'

import type {
    RenderableFieldValue,
    RenderableVariableValue,
} from './value-types'

import { RENDERABLE_UNION_SHAPE } from './kinds'

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

export type RenderableVariableField = {
    name: string;
    typeRef: TypeRef;
    value: RenderableVariableValue;
    optional?: boolean;
}

export type RenderableSelectionSet = {
    rows: RenderableField[];
    spreads: RenderableSpread[];
}

export type RenderableObjectShape = RenderableSelectionSet & {
    typename?: RenderableTypename;
}

export type RenderableUnionShape = {
    kind: typeof RENDERABLE_UNION_SHAPE.COLLAPSED;
    typename: RenderableTypename;
    rows: RenderableField[];
    spreads: RenderableSpread[];
} | {
    kind: typeof RENDERABLE_UNION_SHAPE.VARIANTS;
    variants: RenderableObjectShape[];
}
