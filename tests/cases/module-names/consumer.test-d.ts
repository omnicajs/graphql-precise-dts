import { expectTypeOf, test } from 'vitest'
import type { DocumentNode } from 'graphql'
import type { ResultOf } from '@graphql-typed-document-node/core'
import fragment, { type document } from '@documents/document.graphql'
import details from '@documents/details.graphql'
import query from '@documents/query.graphql'

test('keeps inherited interface fields and imported names distinct from document values', () => {
    expectTypeOf(fragment).toEqualTypeOf<DocumentNode>()
    expectTypeOf(details).toEqualTypeOf<DocumentNode>()
    const result: ResultOf<typeof query> = { item: { id: 'one', label: 'Shelf' } }
    expectTypeOf(result.item).toExtend<document>()
    expectTypeOf(result.item.__typename).toEqualTypeOf<string | undefined>()
    // @ts-expect-error Inherited selected fields remain required.
    const incomplete: ResultOf<typeof query> = { item: { label: 'Shelf' } }
    expectTypeOf(incomplete).toEqualTypeOf<ResultOf<typeof query>>()
})
