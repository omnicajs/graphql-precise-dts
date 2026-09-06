export type Predicate<T> = (value: unknown) => value is T

export type UnknownRecord = Record<string, unknown>

export const isString = (value: unknown): value is string => typeof value === 'string'

export const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object'
    && value !== null
    && !Array.isArray(value)

export const isArrayOf = <T>(
    value: unknown,
    predicate: Predicate<T>
): value is ReadonlyArray<T> => Array.isArray(value) && value.every(predicate)
