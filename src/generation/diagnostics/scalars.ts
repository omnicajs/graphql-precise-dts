import type { ScalarMapping } from '@/config/types'
import type { SchemaSnapshot } from '@/schema/snapshot/types'
import type { TsType } from '@/config/ts-type'
import type {
    GenerationDiagnostic,
} from '../types'
import type { NamingConvention } from '../naming'

const keywordNames = new Set([
    'any',
    'bigint',
    'boolean',
    'never',
    'null',
    'number',
    'object',
    'string',
    'symbol',
    'undefined',
    'unknown',
    'void',
])

const collectReferences = (
    type: TsType,
    references: Set<string>
): void => {
    switch (type.kind) {
        case 'named':
            if (!keywordNames.has(type.name)) references.add(type.name)
            return
        case 'array':
            collectReferences(type.ofType, references)
            return
        case 'generic':
            if (!keywordNames.has(type.name)) references.add(type.name)
            for (const argument of type.arguments) collectReferences(argument, references)
            return
        case 'intersection':
        case 'union':
            for (const member of type.types) collectReferences(member, references)
            return
        case 'object':
            for (const field of type.fields) collectReferences(field.type, references)
            return
        case 'tuple':
            for (const item of type.items) collectReferences(item, references)
            return
        case 'literal':
        case 'null':
        case 'unknown':
            return
    }
}

const mappingTypes = (
    mapping: ScalarMapping
): ReadonlyArray<readonly ['input' | 'output', TsType]> => {
    if ('kind' in mapping) return [[ 'input', mapping ], [ 'output', mapping ]]

    return [
        ...(mapping.input ? [[ 'input', mapping.input ] as const] : []),
        ...(mapping.output ? [[ 'output', mapping.output ] as const] : []),
    ]
}

const generatedNames = (
    snapshot: SchemaSnapshot,
    naming: NamingConvention
): ReadonlySet<string> => {
    const names = new Set([ 'Exact', 'MaybePromise', 'Scalars' ])

    for (const type of snapshot.types) {
        if (type.kind !== 'scalar') names.add(naming.typeName(type.id))
        if (type.kind !== 'object' && type.kind !== 'interface') continue

        for (const field of type.fields) {
            if (field.arguments.length) names.add(naming.typeName(`${type.id}_${field.name}_args`))
        }
    }

    return names
}

export const collectScalarNameDiagnostics = ({
    snapshot,
    naming,
    scalars,
    sourceId,
}: {
    snapshot: SchemaSnapshot
    naming: NamingConvention
    scalars: Readonly<Record<string, ScalarMapping>>
    sourceId: string
}): ReadonlyArray<GenerationDiagnostic> => {
    const names = generatedNames(snapshot, naming)
    const scalarNames = new Set(snapshot.types
        .filter(type => type.kind === 'scalar')
        .map(type => type.id))
    const diagnostics: GenerationDiagnostic[] = []

    for (const [ scalarName, mapping ] of Object.entries(scalars)) {
        if (!scalarNames.has(scalarName)) continue

        const references = new Map<string, Set<'input' | 'output'>>()
        for (const [ usage, type ] of mappingTypes(mapping)) {
            const namesForUsage = new Set<string>()
            collectReferences(type, namesForUsage)
            for (const name of namesForUsage) {
                const usages = references.get(name) ?? new Set()
                usages.add(usage)
                references.set(name, usages)
            }
        }

        for (const [ name, usages ] of references) {
            if (!names.has(name)) continue
            const usage = usages.size === 2 ? 'input and output' : [ ...usages ][0]
            diagnostics.push({
                severity: 'warning',
                code: 'scalar-name-conflict',
                sourceId,
                message: `Scalar "${scalarName}" ${usage} mapping references "${name}", which is also generated from the schema`,
            })
        }
    }

    return diagnostics
}
