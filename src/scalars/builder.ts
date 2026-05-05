import type {
    CustomScalarMapping,
    CustomScalarMappings,
    ScalarPrimitiveMap,
    Scalars,
    ScalarShape,
    ScalarUsage,
} from './types'
import type { TsType } from '../ts-type'

import { isUndefined } from '../lib/predicates'
import {
    namedTsType,
    normalizeTsType,
    renderTsType,
} from '../ts-type'

const scalarPrimitiveTypesMap = {
    ID: { input: 'string', output: 'string' },
    String: { input: 'string', output: 'string' },
    Boolean: { input: 'boolean', output: 'boolean' },
    Int: { input: 'number', output: 'number' },
    Float: { input: 'number', output: 'number' },
} satisfies { [K in keyof Scalars]: ScalarShape<ScalarPrimitiveMap[K]> }

export const getScalarPrimitiveTypeTs = <TScalar extends keyof Scalars>(
    gqlType: TScalar,
    usage: ScalarUsage = 'output'
): TsType => {
    return namedTsType(scalarPrimitiveTypesMap[gqlType][usage] as ScalarPrimitiveMap[TScalar])
}

export const getScalarPrimitiveShapeTs = <TScalar extends keyof Scalars>(
    gqlType: TScalar
): ScalarShape<ScalarPrimitiveMap[TScalar]> => ({
        input: renderTsType(getScalarPrimitiveTypeTs(gqlType, 'input')) as ScalarPrimitiveMap[TScalar],
        output: renderTsType(getScalarPrimitiveTypeTs(gqlType, 'output')) as ScalarPrimitiveMap[TScalar],
    })

export const resolveCustomScalarTypeTs = (
    scalar: CustomScalarMapping,
    usage: ScalarUsage = 'output'
): TsType => {
    return typeof scalar === 'object' && scalar !== null && !('kind' in scalar)
        ? (usage in scalar && !isUndefined(scalar[usage])
            ? normalizeTsType(scalar[usage])
            : namedTsType('unknown')
        )
        : normalizeTsType(scalar)
}

export const isScalarPrimitiveKey = (key: string): key is keyof Scalars => {
    return key in scalarPrimitiveTypesMap
}
export const isScalarCustomKey = (key: string, listScalars: CustomScalarMappings): boolean => {
    return Object.prototype.hasOwnProperty.call(listScalars, key)
}

export const getScalarTsType = (
    namedType: string,
    customScalars: CustomScalarMappings = {},
    usage: ScalarUsage = 'output'
): TsType => {
    return isScalarCustomKey(namedType, customScalars)
        ? resolveCustomScalarTypeTs(customScalars[namedType], usage)
        : isScalarPrimitiveKey(namedType)
            ? getScalarPrimitiveTypeTs(namedType, usage)
            : namedTsType('unknown')
}

export const getScalarTsShape = (
    namedType: string,
    customScalars: CustomScalarMappings = {}
): ScalarShape<string, string> => ({
    input: renderTsType(getScalarTsType(namedType, customScalars, 'input')),
    output: renderTsType(getScalarTsType(namedType, customScalars, 'output')),
})
