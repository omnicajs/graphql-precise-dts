import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import {
    getDocumentFragmentDefinition,
    getFragmentDefinition,
} from './helpers/graphql-document'
import { getTypeForDefinition } from '../../src/models/resolve'
import {
    makeSelectionModel,
    makeSelectionModels,
    makeSelectionsForFields,
} from '../../src/models/selections-builder'
import { makeTestModelContext } from './helpers/model-context'
import { parse } from 'graphql'

import {
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
} from '../../src/kinds'

describe('selections builder', () => {
    test('applies conditional, exclude and nonnull policies while building selection models', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
                nickname: String
                email: String
            }

            type Query {
                user: User!
            }
        `)

        const document = parse(`
            fragment UserCard on User {
                nickname @required
                email @clientOnly
                ...UserBase @include(if: $withBase)
                ... on User @include(if: $withMeta) {
                    id
                }
            }

            fragment UserBase on User {
                id
            }
        `)
        const definition = getFragmentDefinition(`
            fragment UserCard on User {
                nickname @required
                email @clientOnly
                ...UserBase @include(if: $withBase)
                ... on User @include(if: $withMeta) {
                    id
                }
            }
        `)

        const context = makeTestModelContext({
            schema,
            documents: [{
                location: 'user.graphql',
                document,
            }],
            directivePolicies: {
                required: { effect: 'nonnull' },
                clientOnly: { effect: 'exclude' },
            },
        })

        const models = makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            context
        )

        expect(models).toHaveLength(3)
        expect(models[0]).toMatchObject({
            kind: SELECTION_MODEL_KIND.FIELD,
            name: 'nickname',
            responseName: 'nickname',
            typeRef: {
                kind: TYPE_REF_KIND.NON_NULL,
                ofType: {
                    kind: TYPE_REF_KIND.NAMED,
                    name: 'String',
                },
            },
        })
        expect(models[1]).toMatchObject({
            kind: SELECTION_MODEL_KIND.FRAGMENT_SPREAD,
            name: 'UserBase',
            conditional: true,
            directiveNames: [ 'include' ],
        })
        expect(models[2]).toMatchObject({
            kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
            typeCondition: 'User',
            conditional: true,
            directiveNames: [ 'include' ],
        })
    })

    test('skips fragment spreads that are missing from context definitions', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const definition = getFragmentDefinition(`
            fragment UserCard on User {
                ...UserBase
            }
        `)
        const models = makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            makeTestModelContext({ schema })
        )

        expect(models).toEqual([])
    })

    test('returns no inline fragment model when nested typed selections are missing', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const definition = getFragmentDefinition(`
            fragment UserCard on User {
                ... on User {
                    id
                }
            }
        `)
        const selection = definition.selectionSet.selections[0]

        expect(selection.kind).toBe('InlineFragment')

        const model = makeSelectionModel(
            selection,
            { kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT },
            makeTestModelContext({ schema })
        )

        expect(model).toBeUndefined()
    })

    test('throws when a non-typename field is aliased to __typename', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const definition = getFragmentDefinition(`
            fragment UserCard on User {
                __typename: id
            }
        `)

        expect(() => makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            makeTestModelContext({ schema }),
            'fragment "UserCard"'
        )).toThrow('Aliasing a field to "__typename" is not supported because this name is reserved')
    })

    test('allows duplicate fields on the same nesting level for downstream merge', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
                nickname: String
            }

            type Query {
                user: User!
            }
        `)
        const { document, definition } = getDocumentFragmentDefinition(`
            fragment UserCard on User {
                id
                id
            }
        `, 'UserCard')

        expect(() => makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            makeTestModelContext({
                schema,
                documents: [{
                    location: 'features/account/user.graphql',
                    document,
                }],
            }),
            'fragment "UserCard"'
        )).not.toThrow()
    })

    test('allows conflicting aliased fields on the same nesting level for downstream validation', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
                nickname: String
            }

            type Query {
                user: User!
            }
        `)
        const { document, definition } = getDocumentFragmentDefinition(`
            fragment UserCard on User {
                name: nickname
                name: id
            }
        `, 'UserCard')

        expect(() => makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            makeTestModelContext({
                schema,
                documents: [{
                    location: 'features/profile/user.graphql',
                    document,
                }],
            }),
            'fragment "UserCard"'
        )).not.toThrow()
    })

    test('allows repeated fragment spreads on the same nesting level for downstream merge', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const { document, definition } = getDocumentFragmentDefinition(`
            fragment UserBase on User {
                id
            }

            fragment UserCard on User {
                ...UserBase
                ...UserBase
            }
        `, 'UserCard')

        expect(() => makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            makeTestModelContext({
                schema,
                documents: [{
                    location: 'user.graphql',
                    document,
                }],
            }),
            'fragment "UserCard"'
        )).not.toThrow()
    })

    test('allows duplicate response names introduced by inline fragments for downstream merge', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const { document, definition } = getDocumentFragmentDefinition(`
            fragment UserCard on User {
                id
                ... on User {
                    id
                }
            }
        `, 'UserCard')

        expect(() => makeSelectionModels(
            [ ...definition.selectionSet.selections ],
            getTypeForDefinition(definition, schema),
            makeTestModelContext({
                schema,
                documents: [{
                    location: 'features/shared/user.graphql',
                    document,
                }],
            }),
            'fragment "UserCard"'
        )).not.toThrow()
    })

    test('returns empty field selections when source selections or types are missing', () => {
        const schema = buildSchema(`
            type User {
                id: ID!
            }

            type Query {
                user: User!
            }
        `)
        const context = makeTestModelContext({ schema })
        const definition = getFragmentDefinition(`
            fragment UserCard on User {
                id
            }
        `)
        const typedSelections = getTypeForDefinition(definition, schema)

        expect(makeSelectionsForFields(undefined, typedSelections, context)).toEqual([])
        expect(makeSelectionsForFields(
            [ ...definition.selectionSet.selections ],
            undefined,
            context
        )).toEqual([])
    })
})
