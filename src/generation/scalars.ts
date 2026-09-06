import type { ScalarMappings } from '@/config/types'

import { renderType } from './render/type'

export const scalarTypes = {
    Boolean: 'boolean',
    Float: 'number',
    ID: 'string',
    Int: 'number',
    String: 'string',
} as const

export type ScalarType = string

export type ScalarUsage = 'input' | 'output'

export const hasScalarMapping = (
    mappings: ScalarMappings,
    name: string
): boolean => Object.prototype.hasOwnProperty.call(mappings, name)

export const getScalarType = (
    name: string,
    mappings: ScalarMappings,
    usage: ScalarUsage
): ScalarType | undefined => {
    if (hasScalarMapping(mappings, name)) {
        const mapping = mappings[name]
        const type = 'kind' in mapping
            ? mapping
            : mapping[usage]

        return type === undefined ? type : renderType(type)
    }

    return Object.prototype.hasOwnProperty.call(scalarTypes, name)
        ? scalarTypes[name as keyof typeof scalarTypes]
        : undefined
}
