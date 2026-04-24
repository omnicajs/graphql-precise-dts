import {
    describe,
    expect,
    test,
    vi,
} from 'vitest'

import { emitRepeatedSelectionWarnings } from '../../src/lib/repeated-selection-warnings'
import { parse } from 'graphql'

describe('repeated selection warnings', () => {
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

        warn.mockRestore()
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

        expect(warn.mock.calls.some(([ message ]) =>
            typeof message === 'string' && message.includes('Repeated field selection "id"')
        )).toBe(false)

        warn.mockRestore()
    })
})
