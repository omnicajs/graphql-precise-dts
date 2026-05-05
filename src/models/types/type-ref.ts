import type { ScalarShape } from '../../scalars/types'

import { TYPE_REF_KIND } from '../../kinds'

export type TypeRef =
    | { kind: typeof TYPE_REF_KIND.NAMED; name: string }
    | { kind: typeof TYPE_REF_KIND.LIST; ofType: TypeRef }
    | { kind: typeof TYPE_REF_KIND.NON_NULL; ofType: TypeRef }

export type EnumValueEntries = { name: string; value: string }[]
export type ScalarModelShape = ScalarShape<string, string>
