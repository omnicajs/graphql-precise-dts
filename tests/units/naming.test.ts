import {
    describe,
    expect,
    test,
} from 'vitest'

import { createNamingConvention } from '../../src/naming'

import { NAMING_STYLE } from '../../src'
import { OperationTypeNode } from 'graphql'

describe('naming convention', () => {
    test('normalizes short style config for every generated name category', () => {
        const naming = createNamingConvention(NAMING_STYLE.CAMEL_CASE)

        expect(naming.typeName('user_profile')).toBe('userProfile')
        expect(naming.enumValue('IS_ACTIVE')).toBe('isActive')
        expect(naming.operationName('get_user')).toBe('getUser')
        expect(naming.fragmentName('user_fields')).toBe('userFields')
    })

    test('preserves generated names with keep style', () => {
        const naming = createNamingConvention({
            typeNames: NAMING_STYLE.KEEP,
            enumValues: NAMING_STYLE.KEEP,
            operationNames: NAMING_STYLE.KEEP,
            fragmentNames: NAMING_STYLE.KEEP,
        })

        expect(naming.typeName('user_profile')).toBe('user_profile')
        expect(naming.enumValue('IS_ACTIVE')).toBe('IS_ACTIVE')
        expect(naming.operationName('get_user')).toBe('get_user')
        expect(naming.fragmentName('user_fields')).toBe('user_fields')
    })

    test('normalizes short snakeCase style config', () => {
        const naming = createNamingConvention(NAMING_STYLE.SNAKE_CASE)

        expect(naming.typeName('UserProfile')).toBe('user_profile')
        expect(naming.enumValue('IsActive')).toBe('is_active')
        expect(naming.operationName('GetUser')).toBe('get_user')
        expect(naming.fragmentName('UserFields')).toBe('user_fields')
    })

    test('normalizes names when underscore transformation is disabled', () => {
        const naming = createNamingConvention({
            typeNames: NAMING_STYLE.PASCAL_CASE,
            transformUnderscore: false,
        })

        expect(naming.typeName('user_profile')).toBe('UserProfile')
        expect(naming.fieldArgTypeName('query_root', 'user_profile')).toBe('QueryRootUserProfileArgs')
    })

    test.each([
        NAMING_STYLE.PASCAL_CASE,
        NAMING_STYLE.CAMEL_CASE,
        NAMING_STYLE.SNAKE_CASE,
        NAMING_STYLE.KEEP
    ])('preserves source value when normalized name has no words', (namingStyle) => {
        const naming = createNamingConvention(namingStyle)

        expect(naming.typeName('___')).toBe('___')
    })

    test('normalizes field argument helper names from raw schema words for every style', () => {
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).fieldArgTypeName('query_root', 'a_search'))
            .toBe('QueryRootASearchArgs')
        expect(createNamingConvention(NAMING_STYLE.CAMEL_CASE).fieldArgTypeName('query_root', 'a_search'))
            .toBe('queryRootASearchArgs')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).fieldArgTypeName('query_root', 'a_search'))
            .toBe('query_root_a_search_args')
        expect(createNamingConvention(NAMING_STYLE.KEEP).fieldArgTypeName('query_root', 'a_search'))
            .toBe('query_roota_searchArgs')
        expect(createNamingConvention(NAMING_STYLE.KEEP).fieldArgTypeName('queryRoot', 'aSearch'))
            .toBe('queryRootaSearchArgs')
        expect(createNamingConvention(NAMING_STYLE.KEEP).fieldArgTypeName('query_root', 'ASearch'))
            .toBe('query_rootASearchArgs')
    })

    test('normalizes short camelCase style config', () => {
        const naming = createNamingConvention({
            operationNames: NAMING_STYLE.CAMEL_CASE,
        })

        expect(naming.operationTypeName('get_user', OperationTypeNode.QUERY)).toBe('getUserQuery')
    })
})
