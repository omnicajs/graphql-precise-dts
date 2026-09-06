import type {
    CompiledFragmentSpread,
    CompiledOperation,
    CompiledSelection,
} from '../model'
import type { FragmentIndex } from './fragments'

import { invalidDocument } from '../errors'
import { resolve } from './fragments'

type RootField = Exclude<CompiledSelection, CompiledFragmentSpread | { kind: 'inline-fragment' }>

const collectRootFields = (
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex
): ReadonlyArray<RootField> => selections.flatMap(selection => {
    if (selection.kind === 'inline-fragment') {
        return collectRootFields(selection.selections, fragments)
    }
    if (selection.kind !== 'fragment-spread') return [ selection ]

    const fragment = resolve(
        fragments,
        selection.sourcePath,
        selection.name,
        selection.location
    )

    return collectRootFields(fragment.selections, fragments)
})

export const validateSubscription = (
    operation: CompiledOperation,
    fragments: FragmentIndex
): void => {
    if (operation.operation !== 'subscription') return

    const fields = collectRootFields(operation.selections, fragments)
    const responseNames = new Set(fields.map(field => field.name))
    if (responseNames.size !== 1) {
        return invalidDocument(
            `Subscription "${operation.name}" must select only one top-level field`,
            operation.location
        )
    }

    if (fields.some(field => field.field.startsWith('__'))) {
        invalidDocument(
            `Subscription "${operation.name}" must not select an introspection top-level field`,
            fields.find(field => field.field.startsWith('__'))!.location
        )
    }
}
