import type {
    FieldNode,
    FragmentDefinitionNode,
    OperationDefinitionNode,
} from 'graphql'

import {
    afterEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { emitRepeatedSelectionWarnings } from '../../../src/diagnostics/repeated-selection-warnings'
import { parse } from 'graphql'

import { Kind } from 'graphql'

describe('repeated selection warnings', () => {
    const dropLocation = (node: { loc?: unknown }) => {
        Object.defineProperty(node, 'loc', {
            configurable: true,
            value: undefined,
        })
    }

    afterEach(vi.restoreAllMocks)

    test('warns about direct repeated fields and fragment spreads on the same selection set level', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        emitRepeatedSelectionWarnings([{
            location: 'group.graphql',
            document: parse(`
                fragment OwnerFields on User {
                    id
                }

                fragment GroupOwner on Group {
                    owner {
                        id
                        id
                        ...OwnerFields
                        ...OwnerFields
                    }
                }
            `),
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Repeated field selection "id" detected in fragment "GroupOwner" at "group\.graphql:\d+:\d+". The plugin merged it, but the selection is redundant. First occurrence: "group\.graphql:\d+:\d+"./
        ))
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Repeated fragment spread "OwnerFields" detected in fragment "GroupOwner" at "group\.graphql:\d+:\d+". The plugin merged it, but the spread is redundant. First occurrence: "group\.graphql:\d+:\d+"./
        ))

    })

    test('does not warn when the second field comes from an inline fragment', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        emitRepeatedSelectionWarnings([{
            location: 'group.graphql',
            document: parse(`
                fragment GroupOwner on Group {
                    owner {
                        id
                        ... on User {
                            id
                        }
                    }
                }
            `),
        }])

        expect(warn).not.toHaveBeenCalled()
    })

    test('uses unknown operation and selection locations when source metadata is missing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const document = parse(`
            query {
                user {
                    id
                    id
                }
            }
        `)
        const operation = document.definitions[0]

        expect(operation?.kind).toBe(Kind.OPERATION_DEFINITION)

        const userSelection = (operation as OperationDefinitionNode).selectionSet.selections[0] as FieldNode

        expect(userSelection.kind).toBe(Kind.FIELD)
        expect(userSelection.selectionSet).toBeDefined()

        dropLocation(userSelection.selectionSet!.selections[1]!)

        emitRepeatedSelectionWarnings([{
            location: 'anonymous.graphql',
            document,
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringContaining(
            'Repeated field selection "id" detected in query "unknown" at "<unknown location>".'
        ))
    })

    test('keeps repeated selection warnings when the first occurrence has no source metadata', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const document = parse(`
            fragment OwnerFields on User {
                id
            }

            fragment GroupOwner on Group {
                owner {
                    id
                    id
                    ...OwnerFields
                    ...OwnerFields
                }
            }
        `)
        const groupOwner = document.definitions[1] as FragmentDefinitionNode

        expect(groupOwner.kind).toBe(Kind.FRAGMENT_DEFINITION)

        const ownerSelection = groupOwner.selectionSet.selections[0] as FieldNode

        expect(ownerSelection.selectionSet).toBeDefined()

        dropLocation(ownerSelection.selectionSet!.selections[0]!)
        dropLocation(ownerSelection.selectionSet!.selections[2]!)

        emitRepeatedSelectionWarnings([{
            location: 'group.graphql',
            document,
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Repeated field selection "id" detected in fragment "GroupOwner" at "group\.graphql:\d+:\d+". The plugin merged it, but the selection is redundant. First occurrence: "<unknown location>"./
        ))
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Repeated fragment spread "OwnerFields" detected in fragment "GroupOwner" at "group\.graphql:\d+:\d+". The plugin merged it, but the spread is redundant. First occurrence: "<unknown location>"./
        ))
    })

    test('uses unknown current location for repeated fragment spreads without source metadata', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const document = parse(`
            fragment OwnerFields on User {
                id
            }

            fragment GroupOwner on Group {
                owner {
                    ...OwnerFields
                    ...OwnerFields
                }
            }
        `)
        const groupOwner = document.definitions[1] as FragmentDefinitionNode
        const ownerSelection = groupOwner.selectionSet.selections[0] as FieldNode

        expect(ownerSelection.selectionSet).toBeDefined()

        dropLocation(ownerSelection.selectionSet!.selections[1]!)

        emitRepeatedSelectionWarnings([{
            location: 'group.graphql',
            document,
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Repeated fragment spread "OwnerFields" detected in fragment "GroupOwner" at "<unknown location>". The plugin merged it, but the spread is redundant. First occurrence: "group\.graphql:\d+:\d+"./
        ))
    })

    test('ignores documents without repeatable operation or fragment definitions', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        emitRepeatedSelectionWarnings([{
            location: 'schema.graphql',
            document: parse('schema { query: Query }'),
        }])

        expect(warn).not.toHaveBeenCalled()
    })
})
