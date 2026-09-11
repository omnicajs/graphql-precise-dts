import type { applicableRootSubscription as inlineRoot } from 'subscription-applicable-inline.graphql'
import type { applicableRootSubscription as spreadRoot } from 'subscription-applicable-spread.graphql'
import type { applicableRootSubscription as unreachableDirectiveRoot } from 'subscription-unreachable-directive.graphql'
import type { unreachableFragmentFieldsQuery } from 'unreachable-fragment-fields.graphql'
import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'
import type { ScalarVariableQueryVariables as ObjectVariables } from 'scalar-object-variable.graphql'
import type { ScalarVariableQueryVariables as ListVariables } from 'scalar-list-variable.graphql'
import type { schemaInfoQuery } from 'schema-introspection.graphql'
import type { typeInfoQuery } from 'type-introspection.graphql'
import type { introspectionDetailsQuery, TypeMetadata, InputMetadata } from 'introspection-details.graphql'
import type { typenameAliasQuery } from 'typename-alias.graphql'
import type { fragmentAliasQuery } from 'typename-alias-fragment.graphql'
import type { abstractAliasQuery } from 'typename-alias-abstract.graphql'
import type { siblingAliasQuery } from 'typename-alias-sibling.graphql'
import type { repeatedAliasQuery } from 'typename-alias-repeated.graphql'
import type { reversedAliasQuery } from 'typename-alias-repeated-reversed.graphql'
import type { nestedAliasQuery } from 'typename-alias-repeated-nested.graphql'
import type { definitionDirectiveQuery as operationDirective } from 'operation-directive.graphql'
import type { definitionDirectiveQuery as fragmentDirective } from 'fragment-definition-directive.graphql'
import type { definitionDirectiveQuery as variableDirective } from 'variable-definition-directive.graphql'
import type { directiveVariablesQuery } from 'definition-directive-variables.graphql'
import type { nestedDirectiveSubscription } from 'subscription-nested-directive.graphql'

import { expectTypeOf, test } from 'vitest'

test('retains variables used inside scalar literals and definition directives', () => {
    expectTypeOf<ObjectVariables>().toEqualTypeOf<{ text: string }>()
    expectTypeOf<ListVariables>().toEqualTypeOf<{ text: string }>()
    expectTypeOf<VariablesOf<typeof directiveVariablesQuery>>().toEqualTypeOf<{ text: string; other: string }>()
    expectTypeOf<VariablesOf<typeof variableDirective>>().toEqualTypeOf<{ text?: string | null }>()
    expectTypeOf<ResultOf<typeof operationDirective>['echo']>().toEqualTypeOf<string | null>()
    expectTypeOf<ResultOf<typeof fragmentDirective>['echo']>().toEqualTypeOf<string | null>()
    // @ts-expect-error The nested scalar usage still requires the operation variable.
    const missingVariable: ObjectVariables = {}
    void missingVariable
})

test('models introspection nullability and GraphQL enum values without schema-module imports', () => {
    type Kind = 'ENUM' | 'INPUT_OBJECT' | 'INTERFACE' | 'LIST' | 'NON_NULL' | 'OBJECT' | 'SCALAR' | 'UNION'
    expectTypeOf<TypeMetadata['kind']>().toEqualTypeOf<Kind>()
    expectTypeOf<InputMetadata['type']['kind']>().toEqualTypeOf<Kind>()
    expectTypeOf<TypeMetadata['isOneOf']>().toEqualTypeOf<boolean | null>()
    expectTypeOf<TypeMetadata['specifiedByURL']>().toEqualTypeOf<string | null>()
    expectTypeOf<InputMetadata['defaultValue']>().toEqualTypeOf<string | null>()
    expectTypeOf<InputMetadata['isDeprecated']>().toEqualTypeOf<boolean>()
    expectTypeOf<ResultOf<typeof schemaInfoQuery>['__schema']['queryType']['name']>().toEqualTypeOf<string | null>()
    expectTypeOf<ResultOf<typeof typeInfoQuery>['__type']>().toEqualTypeOf<{ __typename?: '__Type'; name: string | null } | null>()
    type Location = ResultOf<typeof introspectionDetailsQuery>['__schema']['directives'][number]['locations'][number]
    expectTypeOf<'VARIABLE_DEFINITION'>().toExtend<Location>()
    // @ts-expect-error Introspection enum values are constrained string literals.
    const invalidKind: TypeMetadata['kind'] = 'UNKNOWN_KIND'
    // @ts-expect-error __schema is a required, non-null meta-field.
    const missingSchema: ResultOf<typeof schemaInfoQuery> = {}
    void invalidKind
    void missingSchema
})

test('preserves response aliases named __typename instead of adding a discriminator', () => {
    expectTypeOf<ResultOf<typeof typenameAliasQuery>>().toEqualTypeOf<{ __typename: string | null }>()
    expectTypeOf<ResultOf<typeof fragmentAliasQuery>>().toEqualTypeOf<{ __typename: string | null }>()
    const direct: ResultOf<typeof typenameAliasQuery> = { __typename: 'arbitrary field value' }
    const fragment: ResultOf<typeof fragmentAliasQuery> = { __typename: null }
    const abstract: ResultOf<typeof abstractAliasQuery> = { item: { __typename: 'arbitrary field value' } }
    const sibling: ResultOf<typeof siblingAliasQuery> = { dog: { __typename: 'Alice', id: '1' } }
    // @ts-expect-error The selected alias must be present even when its value is null.
    const missingAlias: ResultOf<typeof typenameAliasQuery> = {}
    void direct
    void fragment
    void abstract
    void sibling
    void missingAlias
})

test('keeps subscription root fields required while nested selections may be conditional', () => {
    expectTypeOf<VariablesOf<typeof nestedDirectiveSubscription>>().toEqualTypeOf<{ include: boolean }>()
    const omittedNested: ResultOf<typeof nestedDirectiveSubscription> = { item: { __typename: 'L' } }
    // @ts-expect-error A directive on a nested selection does not make the root field optional.
    const omittedRoot: ResultOf<typeof nestedDirectiveSubscription> = {}
    void omittedNested
    void omittedRoot
})

test('preserves aliased values and required fields through nested repeated selections', () => {
    type Pet = { __typename: string | null; name: string | null }
    expectTypeOf<NonNullable<ResultOf<typeof repeatedAliasQuery>['pet']>>().toEqualTypeOf<Pet>()
    expectTypeOf<NonNullable<ResultOf<typeof reversedAliasQuery>['pet']>>().toEqualTypeOf<Pet>()
    const repeated: ResultOf<typeof repeatedAliasQuery> = { pet: { __typename: 'Alice', name: 'Alice' } }
    const reversed: ResultOf<typeof reversedAliasQuery> = { pet: { __typename: 'Alice', name: 'Alice' } }
    const nested: ResultOf<typeof nestedAliasQuery> = { nested: { pet: { __typename: 'Alice', name: 'Alice' } } }
    // @ts-expect-error Merging an alias does not remove the other selected field.
    const missingName: ResultOf<typeof repeatedAliasQuery> = { pet: { __typename: 'Alice' } }
    // @ts-expect-error The response alias remains required after a recursive merge.
    const missingAlias: ResultOf<typeof nestedAliasQuery> = { nested: { pet: { name: 'Alice' } } }
    void repeated
    void reversed
    void nested
    void missingName
    void missingAlias
})

test('excludes fields from fragments unreachable for a concrete parent', () => {
    type Dog = NonNullable<ResultOf<typeof unreachableFragmentFieldsQuery>['dog']>
    expectTypeOf<keyof Dog>().toEqualTypeOf<'__typename' | 'id'>()
    const dog: Dog = { id: '1' }
    // @ts-expect-error A Cat-only field cannot occur on the selected Dog.
    const catField: Dog = { id: '1', nickname: 'Misty' }
    void dog
    void catField
})

test('retains only the applicable subscription root field', () => {
    type Payload = { __typename?: 'Subscription'; first: string | null }
    expectTypeOf<ResultOf<typeof inlineRoot>>().toEqualTypeOf<Payload>()
    expectTypeOf<ResultOf<typeof spreadRoot>>().toEqualTypeOf<Payload>()
    expectTypeOf<ResultOf<typeof unreachableDirectiveRoot>>().toEqualTypeOf<Payload>()
    const payload: ResultOf<typeof spreadRoot> = { first: null }
    // @ts-expect-error A field belonging only to Other is not a subscription root field.
    const wrongRoot: ResultOf<typeof inlineRoot> = { first: null, second: 'other' }
    void payload
    void wrongRoot
})
