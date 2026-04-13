import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { getFragmentDefinition } from './helpers/graphql-document'
import { getTypeForDefinition } from '../../src/models/resolve'
import { makeSelectionModels } from '../../src/models/selections-builder'
import { makeTestModelContext } from './helpers/model-context'
import { parse } from 'graphql'

import {
    SELECTION_MODEL_KIND,
    TYPE_REF_KIND,
} from '../../src/models/kinds'

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
                required: {
                    field: { effect: 'nonnull' },
                },
                clientOnly: {
                    field: { effect: 'exclude' },
                },
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
            directives: [ 'include' ],
        })
        expect(models[2]).toMatchObject({
            kind: SELECTION_MODEL_KIND.INLINE_FRAGMENT,
            typeCondition: 'User',
            conditional: true,
            directives: [ 'include' ],
        })
    })
})
