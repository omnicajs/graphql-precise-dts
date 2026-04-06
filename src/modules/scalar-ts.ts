import type { ConfigScalar } from '../config'
import type {
    ScalarPrimitiveMap,
    ScalarShape,
    Scalars,
    ScalarUsage,
} from '../types/scalars'
import type { ScalarTsType } from '../config'

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
    scalar: ScalarTsType | Partial<ScalarShape<ScalarTsType, ScalarTsType>>,
    usage: ScalarUsage = 'output'
): ScalarTsType => {
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
export const isScalarCustomKey = (key: string, listScalars: ConfigScalar): boolean => {
    return Object.prototype.hasOwnProperty.call(listScalars, key)
}

export const getScalarTsType = (
    namedType: string,
    customScalars: ConfigScalar = {},
    usage: ScalarUsage = 'output'
): ScalarTsType => {
    return isScalarCustomKey(namedType, customScalars)
        ? resolveCustomScalarTypeTs(customScalars[namedType], usage)
        : isScalarPrimitiveKey(namedType)
            ? getScalarPrimitiveTypeTs(namedType, usage)
            : 'unknown'
}

export const getScalarTsShape = (
    namedType: string,
    customScalars: ConfigScalar = {}
): ScalarShape<ScalarTsType, ScalarTsType> => ({
    input: getScalarTsType(namedType, customScalars, 'input'),
    output: getScalarTsType(namedType, customScalars, 'output'),
})
