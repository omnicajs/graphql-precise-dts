import type {
    AddGroupInput,
    CreateUserInput,
    Query,
    QueryGroupMembersArgs,
    Scalars,
    User,
    UsersFilter,
} from '@case/schema'

import { Permission } from '@case/enums'
import { expectTypeOf, test } from 'vitest'

test('preserves schema types and enum values', () => {
    expectTypeOf<Scalars['ID']>().toEqualTypeOf<{ input: string; output: string }>()
    expectTypeOf<Scalars['DateTime']>().toEqualTypeOf<{ input: string; output: string }>()
    expectTypeOf<User['permissions']>().toEqualTypeOf<Array<Permission>>()
    expectTypeOf<NonNullable<Query['user']>>().toEqualTypeOf<User>()
    expectTypeOf<QueryGroupMembersArgs>().toEqualTypeOf<{ groudId: string }>()
    expectTypeOf<UsersFilter>().toEqualTypeOf<{ isOnline: boolean }>()
    expectTypeOf<AddGroupInput>().toEqualTypeOf<{ name: string; createdBy: string }>()
    expectTypeOf<CreateUserInput>().toEqualTypeOf<{
        name: string
        username: string
        firstName?: string | null
        lastName?: string | null
    }>()
    expectTypeOf<`${Permission.GroupCreate}`>().toEqualTypeOf<'GroupCreate'>()
    expectTypeOf<`${Permission.GroupEdit}`>().toEqualTypeOf<'GroupEdit'>()

    // @ts-expect-error An arbitrary string is not a generated enum member.
    const invalidPermission: Permission = 'GroupCreate'
    // @ts-expect-error A generated schema input keeps its required runtime keys.
    const missingCreator: AddGroupInput = { name: 'group' }

    void invalidPermission
    void missingCreator
})
