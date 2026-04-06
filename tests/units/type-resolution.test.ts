import type { DefinitionNodeModel } from '../../src/types/models'
import type {
    FieldNode,
    FragmentDefinitionNode,
    GraphQLObjectType,
} from 'graphql'
import type { SelectionNode } from 'graphql'
import type {
    TypeFieldNode,
    TypeFragmentInlineNode,
    TypeSelectionNode,
} from '../../src/types/selection'

import {
    describe,
    expect,
    test,
} from 'vitest'

import { buildSchema } from 'graphql'
import { filterSelectionsForConcreteType } from '../../src/modules/type-resolution'
import { getNamedType } from 'graphql'
import {
    getFragmentTypeNames,
    getTypeForDefinition,
    makeTypeRefForField,
} from '../../src/modules/type-resolution'
import { parse } from 'graphql'
import { specializeTypeNameSelectionForConcreteType } from '../../src/modules/type-resolution'

import {
    DefinitionNodeKind,
    FieldValueKind,
} from '../../src/enums/model-kinds'
import { Kind } from 'graphql'
import { TypeRefKind } from '../../src/enums/model-kinds'

const getFragmentDefinition = (source: string): FragmentDefinitionNode => {
    const document = parse(source)
    const fragment = document.definitions.find(
        definition => definition.kind === 'FragmentDefinition'
    )

    if (!fragment || fragment.kind !== 'FragmentDefinition') {
        throw new Error('Fragment definition not found')
    }

    return fragment
}

const getSelectionNode = (fragment: FragmentDefinitionNode, index: number): SelectionNode => {
    const selection = fragment.selectionSet.selections[index]

    if (!selection) throw new Error(`Selection at index ${index} not found`)

    return selection
}

const getTypedSelection = (
    tree: WeakMap<SelectionNode, TypeSelectionNode>,
    selection: SelectionNode
): TypeSelectionNode => {
    const typedSelection = tree.get(selection)

    if (!typedSelection) throw new Error('Typed selection not found')

    return typedSelection
}

describe('type resolution for models', () => {
    test('returns possible type names for interface and omits them for object fragments', () => {
        const schema = buildSchema(`
            interface User {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
            }

            type Group {
                id: ID!
            }

            type Query {
                user: User!
                group: Group!
            }
        `)

        const interfaceFragment = getFragmentDefinition(`
            fragment UserDetails on User {
                id
            }
        `)
        const objectFragment = getFragmentDefinition(`
            fragment GroupDetails on Group {
                id
            }
        `)

        expect(getFragmentTypeNames(interfaceFragment, schema)).toEqual({
            onType: 'User',
            onTypeNames: [ 'UserPayload' ],
        })
        expect(getFragmentTypeNames(objectFragment, schema)).toEqual({
            onType: 'Group',
        })
    })

    test('returns possible type names for union fragments', () => {
        const schema = buildSchema(`
            type UserPayload {
                id: ID!
            }

            type Group {
                id: ID!
            }

            union SearchResult = UserPayload | Group

            type Query {
                search: SearchResult!
            }
        `)

        const unionFragment = getFragmentDefinition(`
            fragment SearchResultDetails on SearchResult {
                __typename
            }
        `)

        expect(getFragmentTypeNames(unionFragment, schema)).toEqual({
            onType: 'SearchResult',
            onTypeNames: [ 'UserPayload', 'Group' ],
        })
    })

    test('builds a typed tree for fields, spreads, inline fragments and explicit typename', () => {
        const schema = buildSchema(`
            interface User {
                id: ID!
            }

            type UserPayload implements User {
                id: ID!
                permissions: [String!]!
            }

            type Group {
                owner: User!
            }

            type Query {
                group: Group!
            }
        `)

        const fragment = getFragmentDefinition(`
            fragment GroupOwner on Group {
                owner {
                    __typename
                    id
                    ...UserCore
                    ... on UserPayload {
                        permissions
                    }
                }
            }
        `)

        const tree = getTypeForDefinition(fragment, schema)
        const ownerSelection = getSelectionNode(fragment, 0) as FieldNode
        const ownerTyped = getTypedSelection(tree, ownerSelection) as TypeFieldNode

        expect(ownerTyped.kind, 'Expected owner selection with nested typed selections').toBe(DefinitionNodeKind.FIELD)

        expect(getNamedType(ownerTyped.currentType).name).toBe('User')
        expect(ownerTyped.selections).not.toBeUndefined()

        const nestedSelections = [ ...ownerSelection.selectionSet!.selections ]
        const ownerSelections = ownerTyped.selections as WeakMap<SelectionNode, TypeSelectionNode>

        const typenameTyped = getTypedSelection(ownerSelections, nestedSelections[0])
        const idTyped = getTypedSelection(ownerSelections, nestedSelections[1])
        const spreadTyped = getTypedSelection(ownerSelections, nestedSelections[2])
        const inlineTyped = getTypedSelection(ownerSelections, nestedSelections[3])

        // typeName field check
        expect(typenameTyped).toMatchObject({
            kind: DefinitionNodeKind.FIELD,
            typeNames: [ 'UserPayload' ],
        })

        // id field check
        expect(idTyped.kind, 'Expected typed field for id').toBe(DefinitionNodeKind.FIELD)
        expect(getNamedType((idTyped as TypeFieldNode).currentType).name).toBe('ID')

        // spread definition check
        expect(spreadTyped).toEqual({
            kind: DefinitionNodeKind.FRAGMENT_SPREAD,
            name: 'UserCore',
        })

        // inline definition check
        expect(inlineTyped.kind, 'Expected inline fragment with typed selections').toBe(DefinitionNodeKind.INLINE_FRAGMENT)
        expect((inlineTyped as TypeFragmentInlineNode).typeCondition).toBe('UserPayload')

        expect(nestedSelections[3]).not.toBeUndefined()
        expect(nestedSelections[3].kind).toBe(Kind.INLINE_FRAGMENT)

        // permission nested field check
        const permissionsSelection = (nestedSelections[3] as FieldNode).selectionSet?.selections[0]

        expect(permissionsSelection).not.toBeUndefined()

        expect((inlineTyped as TypeFragmentInlineNode).selections).not.toBeUndefined()

        const inlineFragmentSelections = (inlineTyped as TypeFragmentInlineNode).selections as WeakMap<SelectionNode, TypeSelectionNode>
        const permissionsTyped = getTypedSelection(inlineFragmentSelections, permissionsSelection as SelectionNode)

        expect(permissionsTyped.kind, 'Expected typed field for permissions').toBe(DefinitionNodeKind.FIELD)
        expect(getNamedType((permissionsTyped as TypeFieldNode).currentType).name).toBe('String')
    })

    test('creates nested type refs for non-null and list wrappers', () => {
        const schema = buildSchema(`
            type Query {
                tags: [String!]!
            }
        `)

        const queryType = schema.getQueryType()

        expect(queryType, 'Query type not found').not.toBeUndefined()
        expect(queryType, 'Query type not found').not.toBeNull()

        const tagsField = (queryType as GraphQLObjectType).getFields().tags

        expect(tagsField, 'tags field not found').not.toBeUndefined()
        expect(tagsField, 'tags field not found').not.toBeNull()

        expect(makeTypeRefForField('tags', tagsField.type)).toEqual({
            kind: TypeRefKind.NON_NULL,
            ofType: {
                kind: TypeRefKind.LIST,
                ofType: {
                    kind: TypeRefKind.NON_NULL,
                    ofType: {
                        kind: TypeRefKind.NAMED,
                        name: 'String',
                    },
                },
            },
        })
    })

    test('filters inline fragments by concrete type for object, interface and union conditions', () => {
        const schema = buildSchema(`
            interface Node {
                id: ID!
            }

            interface User {
                id: ID!
            }

            type UserPayload implements Node & User {
                id: ID!
                permissions: [String!]!
            }

            type AdminPayload implements Node & User {
                id: ID!
                role: String!
            }

            type Group implements Node {
                id: ID!
                name: String!
            }

            union SearchResult = UserPayload | Group

            type Query {
                user: User!
            }
        `)

        const fragment = getFragmentDefinition(`
            fragment UserDetails on User {
                id
                ... on UserPayload {
                    permissions
                }
                ... on AdminPayload {
                    role
                }
                ... on User {
                    id
                }
                ... on SearchResult {
                    __typename
                }
                ... on Node {
                    id
                }
            }
        `)

        const userPayload = schema.getType('UserPayload')

        expect(userPayload, 'UserPayload type not found').not.toBeUndefined()
        expect(userPayload, 'UserPayload is not an object').instanceof(Object)

        const filtered = filterSelectionsForConcreteType(
            schema,
            userPayload as GraphQLObjectType,
            [ ...fragment.selectionSet.selections ]
        )

        expect(filtered.map(selection => selection.kind === 'InlineFragment'
            ? selection.typeCondition?.name.value
            : selection.kind)).toEqual([
            'Field',
            'UserPayload',
            'User',
            'SearchResult',
            'Node',
        ])
    })

    test('specializes only typename field values for the concrete type', () => {
        const definitions = [{
            kind: DefinitionNodeKind.FIELD,
            name: '__typename',
            responseName: '__typename',
            typeRef: {
                kind: TypeRefKind.NON_NULL,
                ofType: {
                    kind: TypeRefKind.NAMED,
                    name: 'String',
                },
            },
            value: {
                kind: FieldValueKind.TYPENAME,
                typeNames: [ 'UserPayload', 'AdminPayload' ],
            },
            directives: [],
        }, {
            kind: DefinitionNodeKind.FIELD,
            name: 'id',
            responseName: 'id',
            typeRef: {
                kind: TypeRefKind.NON_NULL,
                ofType: {
                    kind: TypeRefKind.NAMED,
                    name: 'ID',
                },
            },
            value: {
                kind: FieldValueKind.SCALAR,
                typeTs: 'string',
            },
            directives: [],
        }] satisfies DefinitionNodeModel[]

        expect(specializeTypeNameSelectionForConcreteType(definitions, 'UserPayload')).toEqual([{
            kind: DefinitionNodeKind.FIELD,
            name: '__typename',
            responseName: '__typename',
            typeRef: {
                kind: TypeRefKind.NON_NULL,
                ofType: {
                    kind: TypeRefKind.NAMED,
                    name: 'String',
                },
            },
            value: {
                kind: FieldValueKind.TYPENAME,
                typeNames: [ 'UserPayload' ],
            },
            directives: [],
        }, definitions[1]])
    })
})
