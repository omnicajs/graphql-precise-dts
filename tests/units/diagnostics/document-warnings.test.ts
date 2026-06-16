import {
    afterEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import {
    emitDuplicateFragmentDefinitionWarnings,
    emitMissingFragmentDefinitionWarnings,
} from '../../../src/diagnostics/document-warnings'
import { parse } from 'graphql'

describe('document warnings', () => {
    afterEach(vi.restoreAllMocks)

    test('warns about duplicate fragment definitions in the same document and keeps the first one', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        emitDuplicateFragmentDefinitionWarnings([{
            location: 'shared.graphql',
            document: parse(`
                fragment SharedFields on User {
                    id
                }

                fragment SharedFields on User {
                    name
                }

                fragment SharedFields on Group {
                    id
                }
            `),
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Duplicate fragment definition "SharedFields" detected in "shared\.graphql:\d+:\d+". Both definitions target type "User". The plugin keeps the first definition from "shared\.graphql:\d+:\d+" and ignores this duplicate./
        ))
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(
            /Duplicate fragment definition "SharedFields" detected in "shared\.graphql:\d+:\d+". The first definition targets type "User", while the duplicate targets type "Group". The plugin keeps the first definition from "shared\.graphql:\d+:\d+" and ignores this duplicate./
        ))
    })

    test('does not warn about duplicate fragment names in different documents', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

        emitDuplicateFragmentDefinitionWarnings([{
            location: 'user.graphql',
            document: parse(`
                fragment SharedFields on User {
                    id
                }
            `),
        }, {
            location: 'group.graphql',
            document: parse(`
                fragment SharedFields on Group {
                    id
                }
            `),
        }])

        expect(warn).not.toHaveBeenCalled()
    })

    test('falls back to document locations when duplicate fragment nodes have no source', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const document = parse(`
            fragment SharedFields on User {
                id
            }

            fragment SharedFields on User {
                name
            }
        `, { noLocation: true })

        emitDuplicateFragmentDefinitionWarnings([{
            location: 'shared.graphql',
            document,
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringContaining(
            'Duplicate fragment definition "SharedFields" detected in "shared.graphql".'
        ))
    })

    test('falls back to unknown locations when duplicate fragment nodes have no source or document location', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const document = parse(`
            fragment SharedFields on User {
                id
            }

            fragment SharedFields on User {
                name
            }
        `, { noLocation: true })

        emitDuplicateFragmentDefinitionWarnings([{
            document,
        }])

        expect(warn).toHaveBeenCalledWith(expect.stringContaining(
            'Duplicate fragment definition "SharedFields" detected in "<unknown document>".'
        ))
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(
            'keeps the first definition from "<unknown document>"'
        ))
    })

    test('falls back to unknown location for missing fragment spreads without source or document location', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
        const document = parse(`
            query UserQuery {
                user {
                    ...MissingFields
                }
            }
        `, { noLocation: true })

        emitMissingFragmentDefinitionWarnings([{
            document,
        }], new Map())

        expect(warn).toHaveBeenCalledWith(
            'Fragment definition "MissingFields" referenced from "<unknown document>" was not found among the documents configured for the plugin.'
        )
    })
})
