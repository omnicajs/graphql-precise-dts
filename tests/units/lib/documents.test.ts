import type { Source as GraphQLSource } from 'graphql'
import type { DocumentFile } from '../../../src/plugin-types'

import {
    describe,
    expect,
    test,
} from 'vitest'

import { Source } from 'graphql'

import { parse } from 'graphql'
import {
    collectFragmentSpreads,
    findDocumentFragmentDefinitions,
    findFragmentDefinitions,
    formatNodeLocation,
    makeDocumentLocationMap,
} from '../../../src/lib/documents'

describe('document helpers', () => {
    const getFirstDefinition = (source: string) => {
        const document = parse(new Source(source, 'queries/user.graphql'))
        const operation = document.definitions[0]

        if (!operation) throw new Error('Operation definition not found')

        return operation
    }

    const getDocumentSource = (documentFile: DocumentFile): GraphQLSource => {
        const source = documentFile.document?.loc?.source

        if (!source) throw new Error('Document source not found')

        return source
    }

    test('finds the first definition for each fragment name across documents', () => {
        const firstDefinition = parse(`
            fragment UserFields on User {
                id
            }
        `)
        const secondDefinition = parse(`
            fragment UserFields on User {
                name
            }

            fragment GroupFields on Group {
                id
            }
        `)

        const fragments = findFragmentDefinitions([
            { document: firstDefinition },
            { document: undefined },
            { document: secondDefinition },
        ])

        expect([ ...fragments.keys() ]).toEqual([ 'UserFields', 'GroupFields' ])

        expect(fragments.get('UserFields')).toBe(firstDefinition.definitions[0])
        expect(fragments.get('GroupFields')).toBe(secondDefinition.definitions[1])
    })

    test('merges document fragment definitions with fallback fragments', () => {
        const fallbackDocument = parse(`
            fragment UserFields on User {
                id
            }

            fragment GroupFields on Group {
                id
            }
        `)
        const document = parse(`
            fragment UserFields on User {
                name
            }
        `)
        const fallbackFragments = findFragmentDefinitions([
            { document: fallbackDocument },
        ])

        const fragments = findDocumentFragmentDefinitions(document, fallbackFragments)

        expect([ ...fragments.keys() ]).toEqual([ 'UserFields', 'GroupFields' ])

        expect(fragments.get('UserFields')).toBe(document.definitions[0])
        expect(fragments.get('GroupFields')).toBe(fallbackDocument.definitions[1])
    })

    test('uses fallback fragments when document is missing', () => {
        const fallbackDocument = parse(`
            fragment UserFields on User {
                id
            }
        `)
        const fallbackFragments = findFragmentDefinitions([
            { document: fallbackDocument },
        ])

        expect(findDocumentFragmentDefinitions(undefined, fallbackFragments)).toEqual(fallbackFragments)
    })

    test('maps document sources to configured locations', () => {
        const documentFile = {
            document: parse(new Source('query UserQuery { user { id } }', 'GraphQL request')),
            location: 'queries/user.graphql',
        }

        const documentLocations = makeDocumentLocationMap([
            documentFile,
            { document: undefined, location: 'ignored.graphql' },
            { document: parse('query GroupQuery { group { id } }') },
        ])

        expect(documentLocations.get(getDocumentSource(documentFile))).toBe('queries/user.graphql')
    })

    test('uses source name when document location map does not contain the node source', () => {
        const operation = getFirstDefinition('query UserQuery { user { id } }')

        expect(formatNodeLocation(
            operation,
            new WeakMap<GraphQLSource, string>()
        )).toBe('queries/user.graphql:1:1')
    })

    test('collects fragment spreads from document selections', () => {
        const document = parse(`
            query UserQuery {
                user {
                    ...UserFields
                    group {
                        ...GroupFields
                    }
                }
            }
        `)

        expect(collectFragmentSpreads(document).map(spread => spread.name.value)).toEqual([
            'UserFields',
            'GroupFields',
        ])
    })
})
