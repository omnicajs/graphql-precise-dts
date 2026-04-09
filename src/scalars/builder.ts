import type { ConfigScalars } from '../config'
import type {
    ScalarPrimitiveMap,
    ScalarShape,
    Scalars,
} from './types'
import type { ScalarUsage } from './types'
import type { TsTypeString } from '../config'

import { isUndefined } from '../lib/predicates'

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
): ScalarPrimitiveMap[TScalar] => {
    return scalarPrimitiveTypesMap[gqlType][usage] as ScalarPrimitiveMap[TScalar]
}

export const getScalarPrimitiveShapeTs = <TScalar extends keyof Scalars>(
    gqlType: TScalar
): ScalarShape<ScalarPrimitiveMap[TScalar]> => ({
        input: getScalarPrimitiveTypeTs(gqlType, 'input'),
        output: getScalarPrimitiveTypeTs(gqlType, 'output'),
    })

export const resolveCustomScalarTypeTs = (
    scalar: TsTypeString | Partial<ScalarShape<TsTypeString, TsTypeString>>,
    usage: ScalarUsage = 'output'
): TsTypeString => {
    return typeof scalar === 'object' && scalar !== null
        ? (usage in scalar && !isUndefined(scalar[usage])
            ? scalar[usage]
            : 'unknown'
        )
        : scalar
}

export const isScalarPrimitiveKey = (key: string): key is keyof Scalars => {
    return key in scalarPrimitiveTypesMap
}
export const isScalarCustomKey = (key: string, listScalars: ConfigScalars): boolean => {
    return Object.prototype.hasOwnProperty.call(listScalars, key)
}

export const getScalarTsType = (
    namedType: string,
    customScalars: ConfigScalars = {},
    usage: ScalarUsage = 'output'
): TsTypeString => {
    return isScalarCustomKey(namedType, customScalars)
        ? resolveCustomScalarTypeTs(customScalars[namedType], usage)
        : isScalarPrimitiveKey(namedType)
            ? getScalarPrimitiveTypeTs(namedType, usage)
            : 'unknown'
}

export const getScalarTsShape = (
    namedType: string,
    customScalars: ConfigScalars = {}
): ScalarShape<TsTypeString, TsTypeString> => ({
    input: getScalarTsType(namedType, customScalars, 'input'),
    output: getScalarTsType(namedType, customScalars, 'output'),
})
