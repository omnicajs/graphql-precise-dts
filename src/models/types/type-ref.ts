import type { ScalarShape } from '../../scalars/types'

import { TYPE_REF_KIND } from '../../kinds'

export type TypeRef =
    | { kind: typeof TYPE_REF_KIND.NAMED; name: string }
    | { kind: typeof TYPE_REF_KIND.LIST; ofType: TypeRef }
    | { kind: typeof TYPE_REF_KIND.NON_NULL; ofType: TypeRef }

export type EnumValueEntry = {
    name: string;
    value: string;
    description?: string;
    deprecationReason?: string;
}
export type EnumModel = {
    description?: string;
    entries: EnumValueEntry[];
}

export type ScalarModelShape = ScalarShape<string, string> & {
    description?: string;
    specifiedByUrl?: string;
}
