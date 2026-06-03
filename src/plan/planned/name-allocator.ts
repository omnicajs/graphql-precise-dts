export type NameAllocator = (baseName: string, hashInput: string) => string

const MIN_HASH_LENGTH = 4
const MAX_HASH_LENGTH = 8

const makeHash = (value: string): string => {
    let hash = 0x811c9dc5

    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
    }

    return (hash >>> 0).toString(16).padStart(MAX_HASH_LENGTH, '0')
}

const allocateNextIndexedName = (baseName: string, usedNames: Set<string>): string => {
    let index = 2
    let aliasName = `${baseName}${index}`

    while (usedNames.has(aliasName)) {
        index++
        aliasName = `${baseName}${index}`
    }

    return aliasName
}

export const createNameAllocator = (occupiedNames: Iterable<string> = []): NameAllocator => {
    const usedNames = new Set(occupiedNames)
    const reserveName = (name: string): string => {
        usedNames.add(name)
        return name
    }

    return (baseName: string, hashInput: string) => {
        if (!usedNames.has(baseName)) {
            return reserveName(baseName)
        }

        const hash = makeHash(hashInput)

        for (let length = MIN_HASH_LENGTH; length <= MAX_HASH_LENGTH; length++) {
            const aliasName = `${baseName}_${hash.slice(0, length)}`

            if (!usedNames.has(aliasName)) {
                return reserveName(aliasName)
            }
        }

        return reserveName(allocateNextIndexedName(`${baseName}_${hash}`, usedNames))
    }
}
