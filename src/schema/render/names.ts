import type { NamingConvention } from '@/generation/naming'
import type { SchemaSnapshot } from '@/schema/snapshot/types'

const register = (
    names: Map<string, string>,
    name: string,
    owner: string
): void => {
    const existingOwner = names.get(name)
    if (existingOwner) {
        throw new Error(
            `Generated schema declaration name "${name}" is used by both `
            + `${existingOwner} and ${owner}`
        )
    }

    names.set(name, owner)
}

export const validateNames = (
    snapshot: SchemaSnapshot,
    naming: NamingConvention
): void => {
    const names = new Map<string, string>()

    register(names, 'Exact', 'helper "Exact"')
    register(names, 'MaybePromise', 'helper "MaybePromise"')
    register(names, 'Scalars', 'helper "Scalars"')

    for (const type of snapshot.types.filter(type => type.kind === 'enum')) {
        register(names, naming.typeName(type.id), `enum "${type.id}"`)
        const members = new Map<string, string>()
        for (const value of type.values) {
            const memberName = naming.enumMember(value.name)
            if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(memberName)) {
                throw new Error(`Generated enum member name "${memberName}" for "${type.id}.${value.name}" is not a valid TypeScript identifier`)
            }
            register(members, memberName, `enum member "${type.id}.${value.name}"`)
        }
    }

    for (const type of snapshot.types) {
        if (type.kind === 'scalar' || type.kind === 'enum') continue

        register(names, naming.typeName(type.id), `type "${type.id}"`)
        if (type.kind === 'union' || type.kind === 'input-object') continue

        for (const field of type.fields.filter(field => field.arguments.length)) {
            register(
                names,
                naming.typeName(`${type.id}_${field.name}_args`),
                `arguments for "${type.id}.${field.name}"`
            )
        }
    }
}
