import {
    afterEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { emitDuplicateFragmentDefinitionWarnings } from '../../src/diagnostics/document-warnings'
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
})
