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

    test('normalizes acronym runs as words for every configurable name category', () => {
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationTypeName('fetchMGBots', OperationTypeNode.QUERY))
            .toBe('FetchMgBotsQuery')
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationTypeName('MGBots', OperationTypeNode.QUERY))
            .toBe('MgBotsQuery')
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationTypeName('fetch_MG_bots', OperationTypeNode.QUERY))
            .toBe('FetchMgBotsQuery')
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationTypeName('fetchHTTP2Bots', OperationTypeNode.QUERY))
            .toBe('FetchHttp2BotsQuery')
        expect(createNamingConvention({ operationNames: NAMING_STYLE.CAMEL_CASE }).operationTypeName('fetchMGBots', OperationTypeNode.QUERY))
            .toBe('fetchMgBotsQuery')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('fetchMGBots', OperationTypeNode.QUERY))
            .toBe('fetch_mg_bots_query')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('MGBots', OperationTypeNode.QUERY))
            .toBe('mg_bots_query')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('fetch_MG_bots', OperationTypeNode.QUERY))
            .toBe('fetch_mg_bots_query')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('fetchHTTP2Bots', OperationTypeNode.QUERY))
            .toBe('fetch_http2_bots_query')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('fetchMGBOTS', OperationTypeNode.QUERY))
            .toBe('fetch_mgbots_query')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationVariablesTypeName('fetchMGBots', OperationTypeNode.QUERY))
            .toBe('fetch_mg_bots_query_variables')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationPayloadTypeName('fetchMGBots', OperationTypeNode.QUERY))
            .toBe('fetch_mg_bots_query_payload')
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).typeName('MG_BOTS'))
            .toBe('MgBots')
        expect(createNamingConvention(NAMING_STYLE.CAMEL_CASE).enumValue('IS_ACTIVE'))
            .toBe('isActive')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).fragmentName('userHTTP2Fields'))
            .toBe('user_http2_fields')
    })

    test('does not duplicate operation type suffix when operation name already includes it', () => {
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationTypeName('fetchMGBotsQuery', OperationTypeNode.QUERY))
            .toBe('FetchMgBotsQuery')
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationVariablesTypeName('fetchMGBotsQuery', OperationTypeNode.QUERY))
            .toBe('FetchMgBotsQueryVariables')
        expect(createNamingConvention({ operationNames: NAMING_STYLE.CAMEL_CASE }).operationTypeName('fetchMGBotsQuery', OperationTypeNode.QUERY))
            .toBe('fetchMgBotsQuery')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('fetch_mg_bots_query', OperationTypeNode.QUERY))
            .toBe('fetch_mg_bots_query')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationVariablesTypeName('fetch_mg_bots_query', OperationTypeNode.QUERY))
            .toBe('fetch_mg_bots_query_variables')
    })

    test('preserves operation name without words before adding derived suffixes', () => {
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationTypeName('___', OperationTypeNode.QUERY))
            .toBe('___Query')
        expect(createNamingConvention(NAMING_STYLE.PASCAL_CASE).operationVariablesTypeName('___', OperationTypeNode.QUERY))
            .toBe('___QueryVariables')
        expect(createNamingConvention(NAMING_STYLE.CAMEL_CASE).operationPayloadTypeName('___', OperationTypeNode.QUERY))
            .toBe('___QueryPayload')
        expect(createNamingConvention(NAMING_STYLE.SNAKE_CASE).operationTypeName('___', OperationTypeNode.QUERY))
            .toBe('____query')
    })

    test('joins derived operation names without normalization for keep style', () => {
        const naming = createNamingConvention({
            operationNames: NAMING_STYLE.KEEP,
        })

        expect(naming.operationTypeName('get_user', OperationTypeNode.QUERY)).toBe('get_userQuery')
        expect(naming.operationVariablesTypeName('get_user', OperationTypeNode.QUERY)).toBe('get_userQueryVariables')
        expect(naming.operationPayloadTypeName('get_user', OperationTypeNode.QUERY)).toBe('get_userQueryPayload')
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
        NAMING_STYLE.KEEP,
    ])('preserves source value when normalized name has no words', (namingStyle) => {
        const naming = createNamingConvention(namingStyle)

        expect(naming.typeName('___')).toBe('___')
        expect(naming.enumValue('___')).toBe('___')
        expect(naming.operationName('___')).toBe('___')
        expect(naming.fragmentName('___')).toBe('___')
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
