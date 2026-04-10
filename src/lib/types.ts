export type ConstValues<T extends Record<string, string>> = T[keyof T]
