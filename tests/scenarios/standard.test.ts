import {
    afterAll,
    expect,
    test,
} from 'vitest'

import { createFixtureWorkspace } from '../fixtures/workspace'
import { createStandardFixture } from '../fixtures/standard'

const fixtureWorkspace = createFixtureWorkspace()
const { generate, referenceErrors } = createStandardFixture(fixtureWorkspace)

afterAll(fixtureWorkspace.dispose)

test.each([
    'typename-alias-repeated.graphql',
    'typename-alias-repeated-reversed.graphql',
    'typename-alias-repeated-nested.graphql',
])('merges nested __typename aliases with implicit discriminators: %s', async file => {
    expect(referenceErrors(file)).toEqual([])
    const result = await generate(file, 'abstract')
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([])
    expect(result.outputs).toEqual([{
        sourceId: file,
        content: fixtureWorkspace.readFixture(`diagnostics/expected/standard/${file}.d.ts`),
    }])
})

test('retains the implicit discriminator when a repeated alias is statically skipped', async () => {
    const file = 'typename-alias-repeated-skipped.graphql'
    expect(referenceErrors(file)).toEqual([])
    const result = await generate(file, 'abstract')
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([])
    expect(result.outputs).toHaveLength(1)
    expect(result.outputs[0].content).toContain('__typename: \'Cat\' | \'Dog\';')
    expect(result.outputs[0].content).toContain('name: string | null;')
})

// https://spec.graphql.org/September2025/#sec-Schema-Introspection
// https://spec.graphql.org/September2025/#sec-Field-Selections (aliases are unrestricted).
test.each([
    ['schema', 'schema-introspection.graphql'],
    ['type', 'type-introspection.graphql'],
    ['complete introspection', 'introspection-details.graphql'],
    ['typename alias', 'typename-alias.graphql'],
    ['typename alias through a fragment', 'typename-alias-fragment.graphql'],
    ['typename alias on an abstract type', 'typename-alias-abstract.graphql'],
    ['typename alias beside a fragment', 'typename-alias-sibling.graphql'],
])('accepts standard %s selections', async (_kind, file) => {
    expect(referenceErrors(file)).toEqual([])
    const result = await generate(file)
    expect(result.diagnostics).toEqual([])
    expect(result.outputs).toEqual([{
        sourceId: file,
        content: fixtureWorkspace.readFixture(`diagnostics/expected/standard/${file}.d.ts`),
    }])
})

// https://spec.graphql.org/September2025/#sec-Type-System.Directives
test.each([
    ['query', 'operation-directive.graphql'],
    ['fragment definition', 'fragment-definition-directive.graphql'],
    ['variable definition', 'variable-definition-directive.graphql'],
    ['operation and fragment with variable arguments', 'definition-directive-variables.graphql'],
])('accepts a declared directive at the %s location', async (_kind, file) => {
    expect(referenceErrors(file)).toEqual([])
    const result = await generate(file)
    expect(result.diagnostics).toEqual([])
    expect(result.outputs).toEqual([{
        sourceId: file,
        content: fixtureWorkspace.readFixture(`diagnostics/expected/standard/${file}.d.ts`),
    }])
})

// Nested scopes may be valid individually while unreachable for the concrete parent.
test('omits unreachable inline and named fragment fields from concrete selections', async () => {
    const file = 'unreachable-fragment-fields.graphql'
    expect(referenceErrors(file)).toEqual([])
    const result = await generate(file)
    expect(result.diagnostics).toEqual([])
    expect(result.outputs).toEqual([{
        sourceId: file,
        content: fixtureWorkspace.readFixture(`diagnostics/expected/standard/${file}.d.ts`),
    }])
})
