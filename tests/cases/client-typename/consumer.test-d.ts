import type { AgentFields } from 'agent.graphql'
import type { DisplayQueryPayload } from 'display.graphql'
import { expectTypeOf, test } from 'vitest'

test('narrows transformed abstract results in both branches', () => {
    const display = (agent: AgentFields) => {
        if (agent.__typename === 'Team') return agent.title
        return agent.firstName
    }
    expectTypeOf(display).returns.toEqualTypeOf<string>()
    // @ts-expect-error The client contract requires a discriminator.
    const invalid: AgentFields = { firstName: 'Ada' }
    expectTypeOf(invalid).toEqualTypeOf<AgentFields>()
    expectTypeOf<DisplayQueryPayload['person']>().toMatchTypeOf<AgentFields>()
    expectTypeOf<DisplayQueryPayload['conditional']['__typename']>().toEqualTypeOf<'Person' | undefined>()
    expectTypeOf<DisplayQueryPayload['explicit']['__typename']>().toEqualTypeOf<'Person' | 'Team' | undefined>()
    expectTypeOf<DisplayQueryPayload['aliased']['__typename']>().toEqualTypeOf<'Person' | 'Team' | undefined>()
    expectTypeOf<DisplayQueryPayload['aliased']['kind']>().toEqualTypeOf<'Person' | 'Team'>()
    expectTypeOf<DisplayQueryPayload['agent']['__typename']>().toEqualTypeOf<'Person' | 'Team'>()
})

test('retains union members outside the selected inline fragment', () => {
    const display = (agent: DisplayQueryPayload['partial']) => {
        // @ts-expect-error A fragment does not exclude other server result types.
        expectTypeOf(agent.firstName).toEqualTypeOf<string>()
        if (agent.__typename === 'Person') return agent.firstName
        return null
    }
    expectTypeOf(display).returns.toEqualTypeOf<string | null>()
})
