import type {
    CompiledFragmentSpread,
    CompiledOperation,
    CompiledSelection,
} from '../model'
import type { FragmentIndex } from './fragments'
import type { TypeId } from '@/schema/types'

import { invalidDocument } from '../errors'
import { resolve } from './fragments'

type RootField = Exclude<CompiledSelection, CompiledFragmentSpread | { kind: 'inline-fragment' }>

const collectRootFields = (
    selections: ReadonlyArray<CompiledSelection>,
    fragments: FragmentIndex,
    rootType: TypeId
): ReadonlyArray<RootField> => selections.flatMap(selection => {
    if (selection.conditionalDirective) {
        return invalidDocument(
            'Subscription root selections must not use @skip or @include',
            selection.conditionalDirective
        )
    }
    if (selection.kind === 'inline-fragment') {
        if (!selection.possibleTypes.includes(rootType)) return []
        return collectRootFields(selection.selections, fragments, rootType)
    }
    if (selection.kind !== 'fragment-spread') return [ selection ]
    if (!selection.possibleTypes.includes(rootType)) return []

    const fragment = resolve(
        fragments,
        selection.sourcePath,
        selection.name,
        selection.location
    )

    return collectRootFields(fragment.selections, fragments, rootType)
})

export const validateSubscription = (
    operation: CompiledOperation,
    fragments: FragmentIndex
): void => {
    if (operation.operation !== 'subscription') return

    const fields = collectRootFields(operation.selections, fragments, operation.rootType)
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
