import { expectTypeOf, test } from 'vitest'
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { DocumentNode } from 'graphql'
import book, { type FetchBookQueryPayload } from './queries/book.graphql'
import sameBook from '@documents/queries/book.graphql'
import fragment from './fragments/BookFields.graphql'
import mixed from './mixed.graphql'
import remote from './remote.graphql'
import { ReviewState } from '@app/graphql/enums'
import type { Book, Remote } from '@app/graphql/schema'

test('overlays file declarations and preserves aliases, document exports and enum members', () => {
    expectTypeOf(sameBook).toEqualTypeOf(book)
    expectTypeOf(fragment).toEqualTypeOf<DocumentNode>()
    expectTypeOf<ResultOf<typeof book>>().toEqualTypeOf<FetchBookQueryPayload>()
    expectTypeOf<VariablesOf<typeof book>>().toEqualTypeOf<{ id: string }>()
    expectTypeOf<ResultOf<typeof mixed>['book']['title']>().toEqualTypeOf<string>()
    expectTypeOf<Book['state']>().toEqualTypeOf<ReviewState>()
    expectTypeOf<Remote['id']>().toEqualTypeOf<string>()
    const result: ResultOf<typeof book> = { payload: { id: 'b', state: ReviewState.InReview } }
    expectTypeOf(result.payload.id).toEqualTypeOf<string>()
    // @ts-expect-error Only selected fields are exposed.
    expectTypeOf(result.payload.title).toEqualTypeOf<string>()
    // @ts-expect-error Variables must match their input scalar.
    const invalid: VariablesOf<typeof book> = { id: 1 }
    expectTypeOf(invalid).toEqualTypeOf<VariablesOf<typeof book>>()
})

test('keeps unimplemented interface fields without inventing runtime type names', () => {
    const result: ResultOf<typeof remote> = { payload: { kind: 'UnknownImplementation', id: 'r' } }
    expectTypeOf(result.payload.state).toEqualTypeOf<ReviewState | undefined>()
    expectTypeOf(result.payload.kind).toEqualTypeOf<string>()
})
