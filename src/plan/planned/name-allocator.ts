export type NameAllocator = {
    reserve(name: string): void;
    allocate(baseName: string): string;
}

export const createNameAllocator = (occupiedNames: Iterable<string> = []): NameAllocator => {
    const usedNames = new Set(occupiedNames)

    return {
        reserve: (name: string) => {
            usedNames.add(name)
        },
        allocate: (baseName: string) => {
            let aliasName = baseName
            let index = 2

            while (usedNames.has(aliasName)) {
                aliasName = `${baseName}${index}`
                index++
            }

            usedNames.add(aliasName)
            return aliasName
        },
    }
}
